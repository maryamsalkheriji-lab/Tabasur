-- 2026-11-11: لا عدد محدد لأعضاء الفريق (السقف التقني 50 بدل 5). يُشغَّل مرة واحدة في SQL Editor؛ آمن لو شُغّل أكثر من مرة.

create or replace function public.tb_register_team(p_name text, p_name_key text, p_track text, p_members jsonb)
returns public.tb_teams
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team public.tb_teams;
  m      jsonb;
  i      int := 0;
begin
  if jsonb_typeof(p_members) <> 'array' or jsonb_array_length(p_members) < 1 or jsonb_array_length(p_members) > 50 then
    raise exception using errcode = 'P0001', message = 'INVALID_MEMBERS';
  end if;
  if exists (select 1 from public.tb_teams where name_key = p_name_key) then
    raise exception using errcode = 'P0001', message = 'TEAM_NAME_TAKEN';
  end if;
  for m in select value from jsonb_array_elements(p_members) loop
    if exists (select 1 from public.tb_team_members tm where tm.mobile_key = m->>'mobile_key') then
      raise exception using errcode = 'P0001', message = 'MOBILE_TAKEN', detail = m->>'mobile_key';
    end if;
    if exists (select 1 from public.tb_team_members tm where tm.name_key = m->>'name_key') then
      raise exception using errcode = 'P0001', message = 'NAME_TAKEN', detail = m->>'mobile_key';
    end if;
  end loop;

  insert into public.tb_teams (code, name, name_key, track)
  values ('TB-' || lpad(nextval('public.tb_team_code_seq')::text, 3, '0'), p_name, p_name_key, p_track)
  returning * into v_team;

  for m in select value from jsonb_array_elements(p_members) loop
    insert into public.tb_team_members (team_id, mobile, mobile_key, name_key, full_name, registration_id, is_leader, position)
    values (v_team.id, m->>'mobile', m->>'mobile_key', m->>'name_key', m->>'full_name',
            nullif(m->>'registration_id', '')::bigint, i = 0, i);
    i := i + 1;
  end loop;
  return v_team;
end
$$;
revoke all on function public.tb_register_team(text, text, text, jsonb) from public, anon, authenticated;
