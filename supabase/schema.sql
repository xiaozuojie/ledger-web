-- Ledger Web: run entire file in Supabase SQL Editor
create extension if not exists pgcrypto;

create table if not exists templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  builtin boolean not null default false,
  fields jsonb not null default '[]'::jsonb,
  settlement jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists ledgers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  template_id uuid references templates(id),
  settlement_kind text not null check (settlement_kind in ('labor', 'mixed')),
  rates jsonb not null default '{}'::jsonb,
  passphrase_hash text not null,
  invite_slug text unique not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists entries (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references ledgers(id) on delete cascade,
  date text not null,
  fields jsonb not null default '{}'::jsonb,
  groups jsonb not null default '[]'::jsonb,
  override_total numeric null,
  summary text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists extra_charges (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references ledgers(id) on delete cascade,
  name text not null,
  amount numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists ledger_sessions (
  token text primary key,
  ledger_id uuid not null references ledgers(id) on delete cascade,
  expires_at timestamptz not null
);

create index if not exists idx_entries_ledger on entries(ledger_id);
create index if not exists idx_extras_ledger on extra_charges(ledger_id);
create index if not exists idx_sessions_exp on ledger_sessions(expires_at);

alter table templates enable row level security;
alter table ledgers enable row level security;
alter table entries enable row level security;
alter table extra_charges enable row level security;
alter table ledger_sessions enable row level security;

-- no direct table policies for anon (all via SECURITY DEFINER RPCs)

insert into templates (id, name, builtin, fields, settlement)
select
  '11111111-1111-1111-1111-111111111111'::uuid,
  '工时记录',
  true,
  '[{"key":"date","label":"日期","type":"date","required":true},{"key":"groups","label":"工时分组","type":"work_groups","required":true},{"key":"totalDays","label":"合计工日","type":"number","computed":"sum_groups"}]'::jsonb,
  '{"kind":"labor","unitPriceKey":"laborUnitPrice","defaultUnitPrice":300}'::jsonb
where not exists (select 1 from templates where id = '11111111-1111-1111-1111-111111111111'::uuid);

insert into templates (id, name, builtin, fields, settlement)
select
  '22222222-2222-2222-2222-222222222222'::uuid,
  '综合记账（渣土车/做卫生）',
  true,
  '[{"key":"date","label":"日期","type":"date","required":true},{"key":"trucks","label":"渣土车数","type":"truck","required":false},{"key":"laborNote","label":"做卫生人工记录","type":"text","required":false},{"key":"groups","label":"工时分组","type":"work_groups","required":false},{"key":"totalDays","label":"折合人天","type":"number","computed":"sum_groups"}]'::jsonb,
  '{"kind":"mixed","truckUnitPrice":100,"laborUnitPrice":230}'::jsonb
where not exists (select 1 from templates where id = '22222222-2222-2222-2222-222222222222'::uuid);

create or replace function _session_ledger(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  lid uuid;
begin
  select ledger_id into lid
  from ledger_sessions
  where token = p_token and expires_at > now();
  if lid is null then
    raise exception 'UNAUTHORIZED';
  end if;
  return lid;
end;
$$;

create or replace function list_builtin_templates()
returns setof templates
language sql
security definer
set search_path = public
as $$
  select * from templates order by builtin desc, created_at asc;
$$;

create or replace function create_ledger(
  p_name text,
  p_template_id uuid,
  p_passphrase text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tpl templates%rowtype;
  lid uuid;
  slug text;
  tok text;
  kind text;
  rates jsonb;
begin
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'VALIDATION name required';
  end if;
  select * into tpl from templates where id = p_template_id;
  if not found then
    raise exception 'NOT_FOUND template';
  end if;
  kind := coalesce(tpl.settlement->>'kind', 'labor');
  if kind = 'mixed' then
    rates := jsonb_build_object(
      'truckUnitPrice', coalesce((tpl.settlement->>'truckUnitPrice')::numeric, 100),
      'laborUnitPrice', coalesce((tpl.settlement->>'laborUnitPrice')::numeric, 230)
    );
  else
    rates := jsonb_build_object(
      'laborUnitPrice', coalesce((tpl.settlement->>'defaultUnitPrice')::numeric, 300)
    );
  end if;
  slug := substr(encode(gen_random_bytes(6), 'hex'), 1, 10);
  tok := encode(gen_random_bytes(32), 'hex');
  -- 开放账本：不校验口令；hash 占位
  insert into ledgers (name, template_id, settlement_kind, rates, passphrase_hash, invite_slug)
  values (
    trim(p_name),
    p_template_id,
    kind,
    rates,
    crypt('open', gen_salt('bf')),
    slug
  )
  returning id into lid;
  insert into ledger_sessions (token, ledger_id, expires_at)
  values (tok, lid, now() + interval '30 days');
  return jsonb_build_object(
    'ledger_id', lid,
    'invite_slug', slug,
    'session_token', tok,
    'settlement_kind', kind,
    'name', trim(p_name)
  );
end;
$$;

create or replace function open_ledger(p_invite_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  led ledgers%rowtype;
  tok text;
begin
  if p_invite_slug is null or length(trim(p_invite_slug)) = 0 then
    raise exception 'VALIDATION slug required';
  end if;
  select * into led from ledgers where invite_slug = trim(p_invite_slug);
  if not found then
    raise exception 'NOT_FOUND ledger';
  end if;
  tok := encode(gen_random_bytes(32), 'hex');
  insert into ledger_sessions (token, ledger_id, expires_at)
  values (tok, led.id, now() + interval '30 days');
  update ledgers set updated_at = now() where id = led.id;
  return jsonb_build_object(
    'ledger_id', led.id,
    'invite_slug', led.invite_slug,
    'session_token', tok,
    'settlement_kind', led.settlement_kind,
    'name', led.name
  );
end;
$$;

create or replace function list_ledgers()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', l.id,
        'name', l.name,
        'invite_slug', l.invite_slug,
        'settlement_kind', l.settlement_kind,
        'updated_at', l.updated_at
      )
      order by l.updated_at desc
    ),
    '[]'::jsonb
  )
  into result
  from ledgers l;
  return result;
end;
$$;

create or replace function unlock_ledger(
  p_passphrase text default null,
  p_invite_slug text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_invite_slug is not null and length(trim(p_invite_slug)) > 0 then
    return open_ledger(p_invite_slug);
  end if;
  raise exception 'VALIDATION 请使用账本链接或邀请码进入';
end;
$$;

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
    'invite_slug', led.invite_slug
  );
end;
$$;

create or replace function api_update_rates(p_token text, p_rates jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  lid uuid;
begin
  lid := _session_ledger(p_token);
  update ledgers set rates = p_rates, updated_at = now() where id = lid;
  return jsonb_build_object('ok', true, 'rates', p_rates);
end;
$$;

create or replace function api_list_entries(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  lid uuid;
  result jsonb;
begin
  lid := _session_ledger(p_token);
  select coalesce(jsonb_agg(to_jsonb(e) order by e.date, e.created_at), '[]'::jsonb)
  into result
  from entries e
  where e.ledger_id = lid;
  return result;
end;
$$;

create or replace function api_upsert_entry(
  p_token text,
  p_entry_id uuid,
  p_date text,
  p_fields jsonb,
  p_groups jsonb,
  p_override_total numeric,
  p_summary text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  lid uuid;
  eid uuid;
begin
  lid := _session_ledger(p_token);
  if p_entry_id is null then
    insert into entries (ledger_id, date, fields, groups, override_total, summary)
    values (lid, p_date, coalesce(p_fields, '{}'::jsonb), coalesce(p_groups, '[]'::jsonb), p_override_total, p_summary)
    returning id into eid;
  else
    update entries
    set date = p_date,
        fields = coalesce(p_fields, '{}'::jsonb),
        groups = coalesce(p_groups, '[]'::jsonb),
        override_total = p_override_total,
        summary = p_summary,
        updated_at = now()
    where id = p_entry_id and ledger_id = lid
    returning id into eid;
    if eid is null then
      raise exception 'NOT_FOUND entry';
    end if;
  end if;
  update ledgers set updated_at = now() where id = lid;
  return jsonb_build_object('id', eid);
end;
$$;

create or replace function api_remove_entry(p_token text, p_entry_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  lid uuid;
begin
  lid := _session_ledger(p_token);
  delete from entries where id = p_entry_id and ledger_id = lid;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function api_list_extras(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  lid uuid;
  result jsonb;
begin
  lid := _session_ledger(p_token);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at), '[]'::jsonb)
  into result
  from extra_charges x
  where x.ledger_id = lid;
  return result;
end;
$$;

create or replace function api_add_extra(p_token text, p_name text, p_amount numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  lid uuid;
  xid uuid;
begin
  lid := _session_ledger(p_token);
  insert into extra_charges (ledger_id, name, amount)
  values (lid, coalesce(p_name, '零星'), coalesce(p_amount, 0))
  returning id into xid;
  return jsonb_build_object('id', xid);
end;
$$;

create or replace function api_remove_extra(p_token text, p_charge_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  lid uuid;
begin
  lid := _session_ledger(p_token);
  delete from extra_charges where id = p_charge_id and ledger_id = lid;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function api_list_templates(p_token text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  -- templates are listable without session (needed to create ledger)
  select coalesce(jsonb_agg(to_jsonb(t) order by t.builtin desc, t.created_at), '[]'::jsonb)
  into result
  from templates t;
  return result;
end;
$$;

create or replace function api_get_template(p_template_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t templates%rowtype;
begin
  select * into t from templates where id = p_template_id;
  if not found then
    raise exception 'NOT_FOUND template';
  end if;
  return to_jsonb(t);
end;
$$;

create or replace function api_clone_template(p_token text, p_template_id uuid, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  src templates%rowtype;
  nid uuid;
begin
  perform _session_ledger(p_token);
  select * into src from templates where id = p_template_id;
  if not found then
    raise exception 'NOT_FOUND template';
  end if;
  insert into templates (name, builtin, fields, settlement)
  values (coalesce(nullif(trim(p_name), ''), src.name || ' 副本'), false, src.fields, src.settlement)
  returning id into nid;
  return jsonb_build_object('id', nid);
end;
$$;

create or replace function api_update_template(
  p_token text,
  p_template_id uuid,
  p_name text,
  p_fields jsonb,
  p_settlement jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  src templates%rowtype;
begin
  perform _session_ledger(p_token);
  select * into src from templates where id = p_template_id;
  if not found then
    raise exception 'NOT_FOUND template';
  end if;
  if src.builtin then
    raise exception 'FORBIDDEN builtin';
  end if;
  update templates
  set name = coalesce(nullif(trim(p_name), ''), name),
      fields = coalesce(p_fields, fields),
      settlement = coalesce(p_settlement, settlement)
  where id = p_template_id;
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function list_builtin_templates() to anon, authenticated;
grant execute on function create_ledger(text, uuid, text) to anon, authenticated;
grant execute on function open_ledger(text) to anon, authenticated;
grant execute on function list_ledgers() to anon, authenticated;
grant execute on function unlock_ledger(text, text) to anon, authenticated;
grant execute on function api_get_ledger(text) to anon, authenticated;
grant execute on function api_update_rates(text, jsonb) to anon, authenticated;
grant execute on function api_list_entries(text) to anon, authenticated;
grant execute on function api_upsert_entry(text, uuid, text, jsonb, jsonb, numeric, text) to anon, authenticated;
grant execute on function api_remove_entry(text, uuid) to anon, authenticated;
grant execute on function api_list_extras(text) to anon, authenticated;
grant execute on function api_add_extra(text, text, numeric) to anon, authenticated;
grant execute on function api_remove_extra(text, uuid) to anon, authenticated;
grant execute on function api_list_templates(text) to anon, authenticated;
grant execute on function api_get_template(uuid) to anon, authenticated;
grant execute on function api_clone_template(text, uuid, text) to anon, authenticated;
grant execute on function api_update_template(text, uuid, text, jsonb, jsonb) to anon, authenticated;
