create table public.wedding_wishes (
 id uuid primary key default gen_random_uuid(),
 name text not null check(char_length(trim(name)) between 2 and 60),
 message text not null check(char_length(trim(message)) between 3 and 1000),
 created_at timestamptz not null default now()
);
alter table public.wedding_wishes enable row level security;
revoke all on public.wedding_wishes from anon, authenticated;
grant select on public.wedding_wishes to anon, authenticated;
grant insert(name,message) on public.wedding_wishes to anon, authenticated;
create policy wishes_read on public.wedding_wishes for select to anon, authenticated using(true);
create policy wishes_send on public.wedding_wishes for insert to anon, authenticated with check(true);
create index wishes_recent on public.wedding_wishes(created_at desc,id);
alter publication supabase_realtime add table public.wedding_wishes;
