-- 开放账本：有链接/列表即可进入，无需口令。已执行过 schema.sql 的库再跑本文件。

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

-- 兼容旧 unlock：有 slug 则直接开放，忽略口令
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

grant execute on function create_ledger(text, uuid, text) to anon, authenticated;
grant execute on function open_ledger(text) to anon, authenticated;
grant execute on function list_ledgers() to anon, authenticated;
grant execute on function unlock_ledger(text, text) to anon, authenticated;
