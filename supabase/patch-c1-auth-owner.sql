-- C1: 账号归属 + 我的账本列表。在已执行 schema.sql / patch-open-access.sql 的库上再跑。
-- 需在 Supabase 开启 Email Auth（Authentication → Providers → Email）。

-- 允许个人账 kind；owner_id
alter table ledgers drop constraint if exists ledgers_settlement_kind_check;
alter table ledgers
  add constraint ledgers_settlement_kind_check
  check (settlement_kind in ('labor', 'mixed', 'personal'));

alter table ledgers add column if not exists owner_id uuid references auth.users(id);
alter table ledgers add column if not exists meta jsonb not null default '{}'::jsonb;

create index if not exists idx_ledgers_owner on ledgers(owner_id);

-- 个人账模板（若无）
insert into templates (id, name, builtin, fields, settlement)
select
  '33333333-3333-3333-3333-333333333333'::uuid,
  '个人收支',
  true,
  '[{"key":"date","label":"日期","type":"date","required":true},{"key":"amount","label":"金额","type":"number","required":true}]'::jsonb,
  '{"kind":"personal","defaultMonthlyBudget":3000}'::jsonb
where not exists (
  select 1 from templates where id = '33333333-3333-3333-3333-333333333333'::uuid
);

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
  uid uuid;
begin
  uid := auth.uid();
  if uid is null then
    raise exception 'UNAUTHORIZED login required';
  end if;
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
  elsif kind = 'personal' then
    rates := jsonb_build_object(
      'budget', jsonb_build_object(
        'monthly', coalesce((tpl.settlement->>'defaultMonthlyBudget')::numeric, 3000)
      )
    );
  else
    rates := jsonb_build_object(
      'laborUnitPrice', coalesce((tpl.settlement->>'defaultUnitPrice')::numeric, 300),
      'truckUnitPrice', coalesce((tpl.settlement->>'truckUnitPrice')::numeric, 100)
    );
  end if;
  slug := substr(encode(gen_random_bytes(6), 'hex'), 1, 10);
  tok := encode(gen_random_bytes(32), 'hex');
  insert into ledgers (
    name, template_id, settlement_kind, rates, passphrase_hash, invite_slug, owner_id
  )
  values (
    trim(p_name),
    p_template_id,
    kind,
    rates,
    crypt('open', gen_salt('bf')),
    slug,
    uid
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

-- 仅返回当前登录用户拥有的账本
create or replace function list_ledgers()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  uid uuid;
begin
  uid := auth.uid();
  if uid is null then
    return '[]'::jsonb;
  end if;
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
  from ledgers l
  where l.owner_id = uid;
  return result;
end;
$$;

-- 当前用户信息（前端探活）
create or replace function api_whoami()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return jsonb_build_object('authenticated', false);
  end if;
  return jsonb_build_object(
    'authenticated', true,
    'user_id', auth.uid(),
    'email', auth.jwt() ->> 'email'
  );
end;
$$;

grant execute on function create_ledger(text, uuid, text) to anon, authenticated;
grant execute on function list_ledgers() to anon, authenticated;
grant execute on function api_whoami() to anon, authenticated;
