create table private.sk_paypal_me_links (
  user_id uuid primary key references auth.users(id) on delete cascade,
  handle text not null check (handle ~ '^[A-Za-z0-9]{1,20}$')
);
revoke all on private.sk_paypal_me_links from public,anon,authenticated;

create function public.sk_get_paypal_me() returns text
language sql stable security definer set search_path='' as $$
  select handle from private.sk_paypal_me_links where user_id=auth.uid()
$$;

create function public.sk_set_paypal_me(p_handle text) returns text
language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid();
begin
  if actor is null then raise exception 'Bitte anmelden.' using errcode='42501'; end if;
  if p_handle is null then
    delete from private.sk_paypal_me_links where user_id=actor;
  else
    if p_handle !~ '^[A-Za-z0-9]{1,20}$' then
      raise exception 'Ungültiger PayPal.Me-Name.' using errcode='22023';
    end if;
    insert into private.sk_paypal_me_links(user_id,handle) values(actor,p_handle)
    on conflict (user_id) do update set handle=excluded.handle;
  end if;
  return p_handle;
end $$;

create function public.sk_read_settlement_checkout(p_table_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare events jsonb;
declare links jsonb;
begin
  events := public.sk_read_settlement_events(p_table_id);
  select coalesce(jsonb_agg(jsonb_build_object(
    'paymentId',s->>'id','recipientId',recipient->>'userId','handle',link.handle,'amount',s->'amount'
  )), '[]'::jsonb) into links
  from public.sk_live_tables t
  cross join lateral jsonb_array_elements(t.payload->'settlements') s
  cross join lateral jsonb_array_elements(t.payload->'players') payer
  cross join lateral jsonb_array_elements(t.payload->'players') recipient
  join private.sk_paypal_me_links link on link.user_id::text=recipient->>'userId'
  where t.id=p_table_id and t.payload->>'activeGame'='false'
    and payer->>'id'=s->>'fromPlayerId' and payer->>'userId'=auth.uid()::text
    and recipient->>'id'=s->>'toPlayerId'
    and s->>'isPaid' is distinct from 'true'
    and (select e.action from private.sk_settlement_events e
      where e.table_id=t.id and e.payment_id=s->>'id' and e.action in ('confirm','undo_confirm')
      order by e.sequence desc limit 1) is distinct from 'confirm'
    and (select e.action from private.sk_settlement_events e
      where e.table_id=t.id and e.payment_id=s->>'id' and e.action in ('report','undo_report')
      order by e.sequence desc limit 1) is distinct from 'report';
  return jsonb_build_object('events',events,'links',links);
end $$;

revoke all on function public.sk_get_paypal_me() from public,anon;
revoke all on function public.sk_set_paypal_me(text) from public,anon;
revoke all on function public.sk_read_settlement_checkout(uuid) from public,anon;
grant execute on function public.sk_get_paypal_me() to authenticated;
grant execute on function public.sk_set_paypal_me(text) to authenticated;
grant execute on function public.sk_read_settlement_checkout(uuid) to authenticated;
