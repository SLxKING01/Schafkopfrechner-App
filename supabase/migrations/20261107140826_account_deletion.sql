-- Prevent a stale token from uploading again after deletion. The row lock also
-- serializes uploads with the Auth deletion's final check for remaining files.
create function private.sk_can_upload_profile_photo() returns boolean
language sql volatile security definer set search_path='' as $$
  select exists(select 1 from auth.users where id=auth.uid() for key share);
$$;
revoke all on function private.sk_can_upload_profile_photo() from public,anon,authenticated;
grant execute on function private.sk_can_upload_profile_photo() to authenticated;
alter policy sk_profile_photo_insert on storage.objects with check (
  bucket_id='profile-photos'
  and name ~ ('^'||(select auth.uid())::text||'/[0-9a-f-]{36}\.jpg$')
  and (select private.sk_can_upload_profile_photo())
);

alter table private.sk_round_identities
  drop constraint sk_round_identities_registered_by_fkey,
  add constraint sk_round_identities_registered_by_fkey
    foreign key (registered_by) references auth.users(id) on delete set null,
  drop constraint sk_round_identities_table_id_fkey,
  add constraint sk_round_identities_table_id_fkey
    foreign key (table_id) references public.sk_live_tables(id) on delete cascade;
alter table private.sk_round_identity_backups
  drop constraint sk_round_identity_backups_table_id_fkey,
  add constraint sk_round_identity_backups_table_id_fkey
    foreign key (table_id) references public.sk_live_tables(id) on delete cascade;
alter table private.sk_settlement_events alter column actor_id drop not null;
create index sk_settlement_events_by_actor on private.sk_settlement_events(actor_id);

create function private.sk_erase_table_identity(p_payload jsonb, p_user uuid, p_seats text[])
returns jsonb language plpgsql immutable set search_path='' as $$
declare
  history_key text;
  history_path text[];
begin
  if jsonb_typeof(p_payload->'players') = 'array' then
    p_payload := jsonb_set(p_payload, '{players}', (
      select coalesce(jsonb_agg(
        case when player->>'userId'=p_user::text then
          (player-'userId') || '{"name":"Gelöschtes Konto","isLocal":true}'::jsonb
        else player end order by position
      ), '[]'::jsonb)
      from jsonb_array_elements(p_payload->'players') with ordinality as roster(player,position)
    ));
  end if;
  foreach history_key in array array['roundHistory','misdeals','settlementRevisions'] loop
    history_path := array['currentTable',history_key];
    if jsonb_typeof(p_payload#>history_path) = 'array' then
      p_payload := jsonb_set(p_payload, history_path, (
        select coalesce(jsonb_agg(
          case when event->'actor'->>'kind'='account' and event->'actor'->>'id'=p_user::text then
            jsonb_set(event, '{actor}', '{"kind":"local","name":"Gelöschtes Konto"}')
          else event end order by position
        ), '[]'::jsonb)
        from (
          select case when jsonb_typeof(item->'players')='array' then
            jsonb_set(item, '{players}', (
              select coalesce(jsonb_agg(
                case when player->>'id'=any(p_seats) then
                  jsonb_set(player, '{name}', '"Gelöschtes Konto"')
                else player end order by player_position
              ), '[]'::jsonb)
              from jsonb_array_elements(item->'players') with ordinality as players(player,player_position)
            ))
          else item end as event, position
          from jsonb_array_elements(p_payload#>history_path) with ordinality as events(item,position)
        ) as history
      ));
    end if;
  end loop;
  return p_payload;
end;
$$;
revoke all on function private.sk_erase_table_identity(jsonb,uuid,text[]) from public,anon,authenticated;

create function private.sk_before_account_delete() returns trigger
language plpgsql security definer set search_path='' as $$
declare
  target public.sk_live_tables;
  successor uuid;
  seats text[];
  roster_filter jsonb := jsonb_build_array(jsonb_build_object('userId',old.id));
  history_filter jsonb := jsonb_build_array(jsonb_build_object('actor',jsonb_build_object('kind','account','id',old.id)));
  previous_erasure text := coalesce(current_setting('sk.account_erasure',true),'');
begin
  if exists(select 1 from storage.objects where bucket_id='profile-photos' and name like old.id::text||'/%') then
    raise exception 'Remove profile photos through the Storage API before deleting the account.';
  end if;

  -- Live writes take the same table row lock and compare the table version.
  for target in select t.* from public.sk_live_tables t
    where t.owner_id=old.id
      or t.payload->'players' @> roster_filter
      or t.payload#>'{currentTable,roundHistory}' @> history_filter
      or t.payload#>'{currentTable,misdeals}' @> history_filter
      or t.payload#>'{currentTable,settlementRevisions}' @> history_filter
    order by t.id for update
  loop
    successor := target.owner_id;
    if successor=old.id then
      select m.user_id into successor from public.sk_live_members m
        where m.table_id=target.id and m.user_id<>old.id
        order by (m.role='write') desc, m.user_id limit 1;
      if successor is null then
        delete from public.sk_live_tables where id=target.id;
        continue;
      end if;
    end if;
    select array(select p->>'id' from jsonb_array_elements(target.payload->'players') p
      where p->>'userId'=old.id::text) into seats;
    perform set_config('sk.account_erasure',target.id::text,true);
    update public.sk_live_tables set owner_id=successor,
      payload=private.sk_erase_table_identity(target.payload,old.id,seats),
      version=target.version+1, updated_at=clock_timestamp()
      where id=target.id;
    perform set_config('sk.account_erasure',previous_erasure,true);
    update private.sk_settlement_events set player_name='Gelöschtes Konto'
      where table_id=target.id and player_id=any(seats);
  end loop;

  update private.sk_round_identity_backups b set payload=private.sk_erase_table_identity(
    b.payload,old.id,array(select p->>'id' from jsonb_array_elements(b.payload->'players') p
      where p->>'userId'=old.id::text)
  ) where b.payload->'players' @> roster_filter
     or b.payload#>'{currentTable,roundHistory}' @> history_filter
     or b.payload#>'{currentTable,misdeals}' @> history_filter;
  update private.sk_settlement_events set actor_id=null, actor_name='Gelöschtes Konto'
    where actor_id=old.id;
  return old;
end;
$$;
revoke all on function private.sk_before_account_delete() from public,anon,authenticated;
create trigger sk_before_account_delete before delete on auth.users
for each row execute function private.sk_before_account_delete();

-- Only the nested Auth deletion trigger can redact protected history.
create or replace function private.sk_guard_round_identities() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r jsonb;
  registered private.sk_round_identities;
begin
  if tg_op = 'UPDATE' and not (pg_trigger_depth()>1 and current_setting('sk.account_erasure',true) is not distinct from new.id::text) and exists (
    select 1 from jsonb_array_elements(coalesce(old.payload->'currentTable'->'roundHistory','[]'::jsonb))
      with ordinality as history(event,position)
    where new.payload->'currentTable'->'roundHistory'->(position::int - 1) is distinct from event
  ) then
    raise exception 'Gespeicherter Änderungsverlauf darf nicht überschrieben werden.' using errcode='23514';
  end if;
  if jsonb_typeof(new.payload->'rounds') is distinct from 'array' then
    raise exception 'Ungültige Spielliste.' using errcode='23514';
  end if;
  if exists(select 1 from jsonb_array_elements(new.payload->'rounds') x
    group by x->>'id' having count(*) > 1) then
    raise exception 'Eine Spiel-ID darf nur einmal vorkommen.' using errcode='23505';
  end if;
  -- Include tombstones so deletion never frees an ID for another table.
  for r in
    select value from jsonb_array_elements(new.payload->'rounds')
    union all
    select e->'before' from jsonb_array_elements(coalesce(new.payload->'currentTable'->'roundHistory','[]'::jsonb)) e where e ? 'before'
    union all
    select e->'after' from jsonb_array_elements(coalesce(new.payload->'currentTable'->'roundHistory','[]'::jsonb)) e where e ? 'after'
  loop
    if jsonb_typeof(r->'id') is distinct from 'string'
      or nullif(btrim(r->>'id'),'') is null or length(r->>'id') > 200
      or r->>'tableId' is distinct from new.id::text
      or jsonb_typeof(r->'createdAt') is distinct from 'string'
      or nullif(btrim(r->>'createdAt'),'') is null then
      raise exception 'Spiel-ID, Tisch oder Erfassungszeit fehlt.' using errcode='23514';
    end if;
    insert into private.sk_round_identities(round_id,table_id,original_created_at,registered_by)
      values(r->>'id',new.id,r->>'createdAt',auth.uid()) on conflict do nothing;
    select * into strict registered from private.sk_round_identities where round_id=r->>'id';
    if registered.table_id <> new.id or registered.original_created_at <> r->>'createdAt' then
      raise exception 'Die Spiel-ID gehört bereits zu einem anderen Eintrag.' using errcode='23505';
    end if;
  end loop;
  return new;
end $$;

create or replace function private.sk_keep_closed_payment_plan() returns trigger
language plpgsql set search_path='' as $$
begin
  if old.payload->>'activeGame' = 'false' and not (pg_trigger_depth()>1 and current_setting('sk.account_erasure',true) is not distinct from new.id::text) and
    (new.payload->>'activeGame' is distinct from 'false'
      or new.payload->'settlements' is distinct from old.payload->'settlements'
      or (select count(*) <> count(distinct p->>'id') from jsonb_array_elements(new.payload->'players') p)
      or exists (
        select 1 from jsonb_array_elements(old.payload->'players') p
        where not exists (
          select 1 from jsonb_array_elements(new.payload->'players') q
          where q->>'id'=p->>'id'
            and (p->>'userId' is null or q->>'userId'=p->>'userId')
        )
      )) then
    raise exception 'Der abgeschlossene Zahlungsplan kann nicht überschrieben werden.' using errcode='42501';
  end if;
  if old.payload->>'activeGame' = 'true' and new.payload->>'activeGame' = 'false'
    and exists(select 1 from jsonb_array_elements(new.payload->'settlements') s where s->>'isPaid'='true')
  then raise exception 'Zahlungen werden erst nach Tischabschluss bestätigt.' using errcode='42501'; end if;
  return new;
end $$;
