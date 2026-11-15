begin;
create schema if not exists wedding_private;
revoke all on schema wedding_private from public, anon, authenticated;
create table if not exists wedding_private.submissions (
 ip_hash text not null, content_hash text not null, created_at timestamptz not null default now()
);
create index if not exists submissions_recent on wedding_private.submissions(created_at);
create or replace function public.submit_wedding_wish(p_name text,p_message text,p_ip_hash text,p_content_hash text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
 if char_length(trim(p_name)) not between 2 and 60 or char_length(trim(p_message)) not between 3 and 1000 or p_ip_hash !~ '^[a-f0-9]{64}$' or p_content_hash !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_INPUT'; end if;
 perform pg_advisory_xact_lock(736201938);
 delete from wedding_private.submissions where created_at < now()-interval '1 day';
 if exists(select 1 from wedding_private.submissions where ip_hash=p_ip_hash and created_at>now()-interval '60 seconds') or (select count(*) from wedding_private.submissions where ip_hash=p_ip_hash and created_at>now()-interval '1 hour')>=5 then raise exception 'RATE_LIMIT'; end if;
 if exists(select 1 from wedding_private.submissions where content_hash=p_content_hash) then raise exception 'DUPLICATE'; end if;
 insert into public.wedding_wishes(name,message) values(trim(p_name),trim(p_message)) returning id into result;
 insert into wedding_private.submissions(ip_hash,content_hash) values(p_ip_hash,p_content_hash);
 return result;
end; $$;
revoke all on function public.submit_wedding_wish(text,text,text,text) from public,anon,authenticated;
grant execute on function public.submit_wedding_wish(text,text,text,text) to service_role;
revoke insert on public.wedding_wishes from anon,authenticated;
revoke insert(name,message) on public.wedding_wishes from anon,authenticated;
drop policy if exists wishes_send on public.wedding_wishes;
commit;
