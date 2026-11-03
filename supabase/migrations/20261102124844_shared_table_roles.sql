-- Read is the safe default for newly assigned accounts. The owner retains management.
alter table public.sk_live_members add column role text not null default 'read'
  check (role in ('read','write'));
update public.sk_live_members m set role='write' from public.sk_live_tables t
  where t.id=m.table_id and t.owner_id=m.user_id;
-- Keep the old table/user RPC signature for existing clients. Every save rechecks
-- membership and the current role after acquiring the shared table lock.
create or replace function private.sk_live_command(p_action text, p_table_id uuid, p_payload jsonb, p_version bigint, p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  target public.sk_live_tables;
  target_id uuid := p_table_id;
  invite text;
  access_role text;
begin
  if actor is null then raise exception 'Bitte anmelden.' using errcode = '42501'; end if;
  if p_action = 'set_role' then
    select * into strict target from public.sk_live_tables where id=target_id for update;
    if target.owner_id <> actor then
      raise exception 'Nur der Ersteller kann Zugriffsrechte ändern.' using errcode='42501';
    end if;
    if target.version <> p_version then
      raise exception 'Der Tisch wurde inzwischen geändert. Bitte erneut versuchen.' using errcode='40001';
    end if;
    if p_payload->>'role' is null or p_payload->>'role' not in ('read','write')
      or p_payload->>'userId' is null or p_payload->>'userId'=actor::text then
      raise exception 'Ungültige Berechtigung.' using errcode='22023';
    end if;
    update public.sk_live_members set role=p_payload->>'role'
      where table_id=target_id and user_id=(p_payload->>'userId')::uuid;
    if not found then raise exception 'Dieses Konto gehört nicht mehr zum Tisch.' using errcode='42501'; end if;
    update public.sk_live_tables set version=version+1,updated_at=clock_timestamp() where id=target_id;
  elsif p_action = 'join' then
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
      insert into public.sk_live_members(table_id,user_id,role) values (target_id, actor,'write') on conflict (table_id,user_id) do update set role='write';
      insert into private.sk_live_invites(table_id) values (target_id);
    else
      if not exists(select 1 from public.sk_live_members m where m.table_id = target_id and m.user_id = actor) then
        raise exception 'Kein Zugriff auf diesen Tisch.' using errcode = '42501';
      end if;
      select * into strict target from public.sk_live_tables where id=target_id for update;
      if not exists(select 1 from public.sk_live_members m where m.table_id=target_id and m.user_id=actor) then
        raise exception 'Kein Zugriff auf diesen Tisch.' using errcode='42501';
      end if;
      select role into access_role from public.sk_live_members where table_id=target_id and user_id=actor;
      if target.owner_id <> actor then
        if access_role is distinct from 'write' then
          raise exception 'Du hast nur Leserechte. Deine Eingabe bleibt auf diesem Gerät erhalten.' using errcode='42501';
        end if;
        if not (target.payload->>'activeGame')::boolean
          or p_payload->'activeGame' is distinct from target.payload->'activeGame'
          or p_payload->'players' is distinct from target.payload->'players'
          or ((p_payload->'currentTable') - array['roundHistory','dealerId','placedLegerPlayerIds','turboRamschEnabled'])
            is distinct from ((target.payload->'currentTable') - array['roundHistory','dealerId','placedLegerPlayerIds','turboRamschEnabled'])
          or exists (select 1 from jsonb_array_elements(p_payload->'settlements') s where coalesce((s->>'isPaid')::boolean,false))
        then raise exception 'Nur der Ersteller darf Regeln, Spieler, Zahlungen und Tischabschluss verwalten.' using errcode='42501'; end if;
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
  return jsonb_build_object('id', target.id, 'payload', target.payload, 'version', target.version, 'code', invite, 'updatedAt', target.updated_at, 'ownerId', target.owner_id,
    'role', case when target.owner_id=actor then 'write' else (select role from public.sk_live_members where table_id=target_id and user_id=actor) end,
    'members', case when target.owner_id=actor then (select coalesce(jsonb_agg(jsonb_build_object('userId',user_id,'role',role) order by user_id),'[]'::jsonb) from public.sk_live_members where table_id=target_id) else '[]'::jsonb end);
end;
$$;

