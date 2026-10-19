-- fee types + groups live in ledgers.meta (column added by patch-c1-auth-owner.sql)
-- run after schema.sql and patch-c1-auth-owner.sql

create or replace function api_get_ledger(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  lid uuid;
  led ledgers%rowtype;
begin
  lid := _session_ledger(p_token);
  select * into led from ledgers where id = lid;
  return jsonb_build_object(
    'id', led.id,
    'name', led.name,
    'template_id', led.template_id,
    'settlement_kind', led.settlement_kind,
    'rates', led.rates,
    'invite_slug', led.invite_slug,
    'feeTypes', coalesce(led.meta->'feeTypes', '[]'::jsonb),
    'feeGroups', coalesce(led.meta->'feeGroups', '[]'::jsonb)
  );
end;
$$;

create or replace function api_save_fee_catalog(
  p_token text,
  p_fee_types jsonb,
  p_fee_groups jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  lid uuid;
begin
  if jsonb_typeof(coalesce(p_fee_types, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_fee_groups, '[]'::jsonb)) <> 'array' then
    raise exception 'INVALID fee catalog';
  end if;
  lid := _session_ledger(p_token);
  update ledgers
  set meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object(
        'feeTypes', coalesce(p_fee_types, '[]'::jsonb),
        'feeGroups', coalesce(p_fee_groups, '[]'::jsonb)
      ),
      updated_at = now()
  where id = lid;
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function api_get_ledger(text) to anon, authenticated;
grant execute on function api_save_fee_catalog(text, jsonb, jsonb) to anon, authenticated;
