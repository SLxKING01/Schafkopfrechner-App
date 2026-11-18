-- Same pattern as profiles, friends and account deletion: the SECURITY DEFINER
-- implementation lives in the unexposed private schema and the API only sees a
-- SECURITY INVOKER wrapper. Behaviour, names and signatures stay unchanged.

alter function public.sk_read_settlement_events(uuid) set schema private;
alter function public.sk_record_settlement_event(uuid,text,text,uuid,uuid) set schema private;
alter function public.sk_get_paypal_me() set schema private;
alter function public.sk_set_paypal_me(text) set schema private;
alter function public.sk_read_settlement_checkout(uuid) set schema private;

-- The checkout reads events through the private implementation directly.
create or replace function private.sk_read_settlement_checkout(p_table_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare events jsonb;
declare links jsonb;
begin
  events := private.sk_read_settlement_events(p_table_id);
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

create function public.sk_read_settlement_events(p_table_id uuid) returns jsonb
language sql stable set search_path='' as $$ select private.sk_read_settlement_events(p_table_id); $$;
create function public.sk_record_settlement_event(
  p_table_id uuid,p_payment_id text,p_action text,p_request_id uuid,p_expected_event uuid
) returns void language sql set search_path='' as $$
  select private.sk_record_settlement_event(p_table_id,p_payment_id,p_action,p_request_id,p_expected_event);
$$;
create function public.sk_get_paypal_me() returns text
language sql stable set search_path='' as $$ select private.sk_get_paypal_me(); $$;
create function public.sk_set_paypal_me(p_handle text) returns text
language sql set search_path='' as $$ select private.sk_set_paypal_me(p_handle); $$;
create function public.sk_read_settlement_checkout(p_table_id uuid) returns jsonb
language sql stable set search_path='' as $$ select private.sk_read_settlement_checkout(p_table_id); $$;

revoke all on function
  private.sk_read_settlement_events(uuid),
  private.sk_record_settlement_event(uuid,text,text,uuid,uuid),
  private.sk_get_paypal_me(),
  private.sk_set_paypal_me(text),
  private.sk_read_settlement_checkout(uuid),
  public.sk_read_settlement_events(uuid),
  public.sk_record_settlement_event(uuid,text,text,uuid,uuid),
  public.sk_get_paypal_me(),
  public.sk_set_paypal_me(text),
  public.sk_read_settlement_checkout(uuid)
from public, anon;
grant execute on function
  private.sk_read_settlement_events(uuid),
  private.sk_record_settlement_event(uuid,text,text,uuid,uuid),
  private.sk_get_paypal_me(),
  private.sk_set_paypal_me(text),
  private.sk_read_settlement_checkout(uuid),
  public.sk_read_settlement_events(uuid),
  public.sk_record_settlement_event(uuid,text,text,uuid,uuid),
  public.sk_get_paypal_me(),
  public.sk_set_paypal_me(text),
  public.sk_read_settlement_checkout(uuid)
to authenticated;
