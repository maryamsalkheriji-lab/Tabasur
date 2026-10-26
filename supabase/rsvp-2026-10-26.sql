-- Guest replies are private to the existing judging admins.
-- The random response ID is a write-only receipt, retained for safe retries/edits.
begin;

create table if not exists public.jd_rsvps (
  id uuid primary key,
  event_id uuid not null references public.jd_events(id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 120),
  status text not null check (status in ('attending', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists jd_rsvps_event_created on public.jd_rsvps(event_id, created_at desc, id);
alter table public.jd_rsvps enable row level security;
revoke all on public.jd_rsvps from public, anon, authenticated;
grant select on public.jd_rsvps to authenticated;
drop policy if exists jd_rsvps_admin_read on public.jd_rsvps;
create policy jd_rsvps_admin_read on public.jd_rsvps for select to authenticated
  using (coalesce(public.jd_is_admin(), false) and auth.jwt()->>'judge_id' is null);

create or replace function public.jd_submit_rsvp(p_slug text, p_response_id uuid, p_name text, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_event_id uuid;
  v_name text := btrim(regexp_replace(p_name, '[[:space:]]+', ' ', 'g'));
begin
  if p_response_id is null or v_name is null or char_length(v_name) not between 2 and 120
    or v_name ~ '[[:cntrl:]]' or v_name !~ '[[:alpha:]]'
    or p_status is null or p_status not in ('attending', 'declined') then
    raise exception 'invalid response' using errcode = '22023';
  end if;
  select id into v_event_id from public.jd_events where slug = p_slug;
  if v_event_id is null then raise exception 'event not found' using errcode = '22023'; end if;
  insert into public.jd_rsvps(id, event_id, full_name, status)
    values(p_response_id, v_event_id, v_name, p_status)
    on conflict (id) do update set full_name = excluded.full_name, status = excluded.status, updated_at = now()
      where jd_rsvps.event_id = excluded.event_id;
  if not found then raise exception 'invalid response' using errcode = '22023'; end if;
end;
$$;
revoke all on function public.jd_submit_rsvp(text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.jd_submit_rsvp(text, uuid, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
commit;
