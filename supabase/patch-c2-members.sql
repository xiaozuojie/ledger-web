-- C2 members. Run after patch-fee-types-meta.sql.
-- Link access stays the default. members mode requires login as owner or invited user.

create table if not exists ledger_members (
  ledger_id uuid not null references ledgers(id) on delete cascade,
  user_id uuid not null,
  email text,
  role text not null default 'editor',
  created_at timestamptz not null default now(),
  primary key (ledger_id, user_id)
);

alter table ledger_members enable row level security;

drop function if exists open_ledger(text);

create or replace function open_ledger(p_invite_slug text, p_pin text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  led ledgers%rowtype;
  tok text;
  mode text;
  uid uuid;
  mrole text;
  role text;
begin
  if p_invite_slug is null or length(trim(p_invite_slug)) = 0 then
    raise exception 'VALIDATION slug required';
  end if;
  select * into led from ledgers where invite_slug = trim(p_invite_slug);
  if not found then
    raise exception 'NOT_FOUND ledger';
  end if;
  mode := coalesce(led.meta->>'accessMode', 'link');
  uid := auth.uid();
  role := 'editor';
  if uid is not null and uid = led.owner_id then
    role := 'owner';
  elsif mode = 'members' then
    select m.role into mrole
    from ledger_members m
    where m.ledger_id = led.id and m.user_id = uid;
    if mrole is null then
      raise exception 'FORBIDDEN 仅成员可进入，请先登录并让主人用邮箱邀请';
    end if;
    role := mrole;
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
    'name', led.name,
    'role', role
  );
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
  members jsonb;
begin
  lid := _session_ledger(p_token);
  select * into led from ledgers where id = lid;
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', m.user_id,
        'email', m.email,
        'name', coalesce(m.email, ''),
        'role', m.role
      )
    ),
    '[]'::jsonb
  )
  into members
  from ledger_members m
  where m.ledger_id = lid;
  return jsonb_build_object(
    'id', led.id,
    'name', led.name,
    'template_id', led.template_id,
    'settlement_kind', led.settlement_kind,
    'rates', led.rates,
    'invite_slug', led.invite_slug,
    'feeTypes', coalesce(led.meta->'feeTypes', '[]'::jsonb),
    'feeGroups', coalesce(led.meta->'feeGroups', '[]'::jsonb),
    'accessMode', coalesce(led.meta->>'accessMode', 'link'),
    'members', members
  );
end;
$$;

create or replace function api_set_access(p_token text, p_mode text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  lid uuid;
  mode text;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED login required';
  end if;
  lid := _session_ledger(p_token);
  if not exists (
    select 1 from ledgers where id = lid and owner_id = auth.uid()
  ) then
    raise exception 'FORBIDDEN 只有账本主人可以修改';
  end if;
  mode := case when p_mode = 'members' then 'members' else 'link' end;
  update ledgers
  set meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('accessMode', mode),
      updated_at = now()
  where id = lid;
  return jsonb_build_object('ok', true, 'accessMode', mode);
end;
$$;

create or replace function api_invite_member(p_token text, p_email text, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  lid uuid;
  uid uuid;
  role text;
  mail text;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED login required';
  end if;
  lid := _session_ledger(p_token);
  if not exists (
    select 1 from ledgers where id = lid and owner_id = auth.uid()
  ) then
    raise exception 'FORBIDDEN 只有账本主人可以邀请';
  end if;
  mail := lower(trim(coalesce(p_email, '')));
  if mail = '' then
    raise exception 'VALIDATION email required';
  end if;
  select id into uid from auth.users where lower(email) = mail limit 1;
  if uid is null then
    raise exception 'NOT_FOUND 对方还没注册胖虎记账';
  end if;
  role := case when p_role = 'viewer' then 'viewer' else 'editor' end;
  insert into ledger_members (ledger_id, user_id, email, role)
  values (lid, uid, mail, role)
  on conflict (ledger_id, user_id) do update
    set email = excluded.email, role = excluded.role;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function api_remove_member(p_token text, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  lid uuid;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED login required';
  end if;
  lid := _session_ledger(p_token);
  if not exists (
    select 1 from ledgers where id = lid and owner_id = auth.uid()
  ) then
    raise exception 'FORBIDDEN 只有账本主人可以移除';
  end if;
  delete from ledger_members where ledger_id = lid and user_id = p_user_id;
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function open_ledger(text, text) to anon, authenticated;
grant execute on function api_get_ledger(text) to anon, authenticated;
grant execute on function api_set_access(text, text) to anon, authenticated;
grant execute on function api_invite_member(text, text, text) to anon, authenticated;
grant execute on function api_remove_member(text, uuid) to anon, authenticated;
