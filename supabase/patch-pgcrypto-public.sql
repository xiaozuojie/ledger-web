-- Supabase 默认把 pgcrypto 装在 extensions schema；
-- SECURITY DEFINER 函数若只 set search_path = public，会报 gen_random_bytes / crypt 不存在。
-- 新建项目跑完 schema.sql 后执行本文件（或已并入联调流程）。

create extension if not exists pgcrypto with schema extensions;
grant usage on schema extensions to postgres, anon, authenticated, service_role;

create or replace function public.gen_random_bytes(n integer)
returns bytea
language sql
security definer
set search_path = extensions, public
as $$ select extensions.gen_random_bytes(n) $$;

create or replace function public.gen_salt(type text)
returns text
language sql
security definer
set search_path = extensions, public
as $$ select extensions.gen_salt(type) $$;

create or replace function public.gen_salt(type text, iter_count integer)
returns text
language sql
security definer
set search_path = extensions, public
as $$ select extensions.gen_salt(type, iter_count) $$;

create or replace function public.crypt(password text, salt text)
returns text
language sql
security definer
set search_path = extensions, public
as $$ select extensions.crypt(password, salt) $$;
