-- Account search only reveals people the searcher already knows: confirmed
-- friends and co-members of a shared table. Blocked pairs never match, and
-- each account may search at most 30 times per minute.
create or replace function private.sk_player_accounts(p_query text) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); result jsonb; ids uuid[]; needle text:=lower(left(btrim(coalesce(p_query,'')),80));
begin
 if actor is null then raise exception 'Bitte anmelden.' using errcode='42501'; end if;
 if needle='' then
  ids:=array[actor];
 elsif char_length(needle)<2 then
  return '[]'::jsonb;
 else
  if not private.sk_friend_limit(actor,'account_search',30) then
   raise exception 'Zu viele Suchanfragen. Bitte kurz warten.' using errcode='PT429';
  end if;
  select array_agg(user_id) into ids from (
   select p.user_id from private.sk_profiles p
   where strpos(lower(p.display_name),needle)>0
    and (p.user_id=actor or (
     not private.sk_friend_pair_blocked(actor,p.user_id) and (
      exists(select 1 from private.sk_friend_pairs f where f.low_id=least(actor,p.user_id) and f.high_id=greatest(actor,p.user_id) and f.state='friends')
      or exists(select 1 from public.sk_live_members a join public.sk_live_members b on a.table_id=b.table_id where a.user_id=actor and b.user_id=p.user_id))))
   order by p.display_name,p.user_id limit 20
  ) matches;
 end if;
 ids:=coalesce(ids,'{}');
 delete from private.sk_profile_image_access where viewer_id=actor and expires_at<now();
 insert into private.sk_profile_image_access(viewer_id,profile_id,expires_at) select actor,unnest(ids),now()+interval '15 minutes' on conflict(viewer_id,profile_id) do update set expires_at=excluded.expires_at;
 select coalesce(jsonb_agg(private.sk_profile_card(p)||jsonb_build_object('name',p.display_name) order by p.display_name,p.user_id),'[]'::jsonb) into result from private.sk_profiles p where user_id=any(ids);
 return result;
end $$;
revoke all on function private.sk_player_accounts(text) from public,anon;
grant execute on function private.sk_player_accounts(text) to authenticated;
