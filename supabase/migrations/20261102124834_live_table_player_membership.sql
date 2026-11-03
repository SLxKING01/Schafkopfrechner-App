-- Membership follows account IDs in the player roster, never display names or invite codes.
create function private.sk_live_roster_members() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if (select count(*) from jsonb_array_elements(new.payload->'players') p where p->>'userId' is not null) <>
     (select count(distinct p->>'userId') from jsonb_array_elements(new.payload->'players') p where p->>'userId' is not null)
  then raise exception 'Ein Benutzerkonto kann nur einmal am Tisch sitzen.'; end if;
  insert into public.sk_live_members(table_id,user_id)
    select new.id,(p->>'userId')::uuid from jsonb_array_elements(new.payload->'players') p where p->>'userId' is not null
    on conflict do nothing;
  delete from public.sk_live_members m where m.table_id=new.id and m.user_id<>new.owner_id and not exists(
    select 1 from jsonb_array_elements(new.payload->'players') p where p->>'userId'=m.user_id::text);
  return new;
end $$;
revoke all on function private.sk_live_roster_members() from public,anon,authenticated;
create trigger sk_live_roster_members after insert or update of payload on public.sk_live_tables
  for each row execute function private.sk_live_roster_members();
-- Reconcile existing code-based memberships with the explicitly assigned players.
update public.sk_live_tables set payload=payload;

create or replace function private.sk_live_command(p_action text, p_table_id uuid, p_payload jsonb, p_version bigint, p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  target public.sk_live_tables;
  target_id uuid := p_table_id;
  invite text;
begin
  if actor is null then raise exception 'Bitte anmelden.' using errcode = '42501'; end if;
  if p_action = 'join' then
    raise exception 'Der Zugriff wird über die eingetragenen Spielerkonten vergeben. Ein Tischcode ist nicht mehr erforderlich.' using errcode='42501';
  elsif p_action in ('create', 'save') then
    if p_payload is null or jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 5000000
      or (p_payload->'currentTable'->>'id') is distinct from target_id::text
      or jsonb_typeof(p_payload->'players') is distinct from 'array'
      or jsonb_typeof(p_payload->'rounds') is distinct from 'array'
      or jsonb_typeof(p_payload->'balances') is distinct from 'array'
      or jsonb_typeof(p_payload->'settlements') is distinct from 'array'
      or jsonb_typeof(p_payload->'activeGame') is distinct from 'boolean'
      or exists (select 1 from jsonb_array_elements(p_payload->'rounds') r where r->>'tableId' is distinct from target_id::text)
    then raise exception 'Ungültiger Tischstand.'; end if;
    if p_action = 'create' then
      if p_version <> 0 then raise exception 'Ungültige Version.'; end if;
      insert into public.sk_live_tables(id, owner_id, payload) values (target_id, actor, p_payload);
      insert into public.sk_live_members values (target_id, actor) on conflict do nothing;
      insert into private.sk_live_invites(table_id) values (target_id);
    else
      if not exists(select 1 from public.sk_live_members m where m.table_id = target_id and m.user_id = actor) then
        raise exception 'Kein Zugriff auf diesen Tisch.' using errcode = '42501';
      end if;
      select * into strict target from public.sk_live_tables where id=target_id for update;
      if not exists(select 1 from public.sk_live_members m where m.table_id=target_id and m.user_id=actor) then
        raise exception 'Kein Zugriff auf diesen Tisch.' using errcode='42501';
      end if;
      if target.owner_id <> actor and
        (select coalesce(jsonb_agg(x order by x), '[]'::jsonb) from (select jsonb_build_array(p->>'id',p->>'userId') x from jsonb_array_elements(p_payload->'players') p where p->>'userId' is not null) ids)
        is distinct from
        (select coalesce(jsonb_agg(x order by x), '[]'::jsonb) from (select jsonb_build_array(p->>'id',p->>'userId') x from jsonb_array_elements(target.payload->'players') p where p->>'userId' is not null) ids)
      then raise exception 'Nur der Tischbesitzer kann Spielerkonten zuordnen.' using errcode='42501'; end if;
      update public.sk_live_tables t set payload = p_payload, version = t.version + 1, updated_at = clock_timestamp()
        where t.id = target_id and t.version = p_version;
      if not found then raise exception 'Der Tisch wurde inzwischen geändert. Bitte aktuellen Stand laden.' using errcode = '40001'; end if;
    end if;
  elsif p_action <> 'read' then
    raise exception 'Unbekannte Aktion.';
  end if;
  if not exists(select 1 from public.sk_live_members m where m.table_id = target_id and m.user_id = actor) then
    raise exception 'Kein Zugriff auf diesen Tisch.' using errcode = '42501';
  end if;
  select * into strict target from public.sk_live_tables where id = target_id;
  select code into invite from private.sk_live_invites where table_id = target_id;
  return jsonb_build_object('id', target.id, 'payload', target.payload, 'version', target.version, 'code', invite, 'updatedAt', target.updated_at, 'ownerId', target.owner_id);
end;
$$;

create function private.sk_player_accounts(p_query text) returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name)), '[]'::jsonb) from (
    select p.id, coalesce(nullif(btrim(u.raw_user_meta_data->>'display_name'),''),nullif(btrim(u.raw_user_meta_data->>'username'),''),nullif(btrim(p.display_name),''),'Spieler') as name
    from auth.users u
    cross join lateral (select u.id,
      coalesce(nullif(btrim(u.raw_user_meta_data->>'display_name'),''),
      nullif(btrim(u.raw_user_meta_data->>'username'),''),'Spieler') as display_name) p
    where auth.uid() is not null and (
      (length(btrim(coalesce(p_query,'')))>=2 and p.display_name ilike '%' || left(btrim(p_query),80) || '%')
      or (btrim(coalesce(p_query,''))='' and p.id=auth.uid())
    ) order by name,p.id limit 20
  ) matches;
$$;
revoke all on function private.sk_player_accounts(text) from public,anon;
grant execute on function private.sk_player_accounts(text) to authenticated;
create function public.sk_player_accounts(p_query text default '') returns jsonb language sql stable security invoker set search_path='' as $$
  select private.sk_player_accounts(p_query);
$$;
revoke all on function public.sk_player_accounts(text) from public,anon;
grant execute on function public.sk_player_accounts(text) to authenticated;
alter publication supabase_realtime add table public.sk_live_members;
