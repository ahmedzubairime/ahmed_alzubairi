-- Phase 5 (project.md §6.7, §6.15, §7, §9). Additive only: one new function,
-- one widened check, one new index. No table or column changes.

-- A signed-in client registers for a course (§6.7). The seat rule holds under
-- concurrency: the course row is locked first, so two callers racing for the
-- last seat run one after the other, and the second one counts the first
-- one's committed row.
--
-- outcome:
--   registered          a new row
--   already_registered  the client already had one (not an error)
--   full                `seats` is set and every seat is taken
--   closed              not published, not in_person/online_live, or no
--                       future `starts_at`
-- seats_left: after this call; null when the course has no seat limit.
--
-- Errors carry a fixed message and SQLSTATE, so the route can map them:
--   P0002 no_data_found:          course_not_found
--   42501 insufficient_privilege: not_a_client
create function public.register_for_course(p_course_id uuid, p_client_id text)
returns table (outcome text, seats_left integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  course record;
  taken integer;
begin
  if not exists (
    select 1
    from public.profiles p
    where p.clerk_user_id = p_client_id
      and p.role_id is null
      and p.status = 'active'
  ) then
    raise exception 'not_a_client' using errcode = '42501';
  end if;

  select c.id, c.type, c.status, c.starts_at, c.seats
  into course
  from public.courses c
  where c.id = p_course_id
  for update;

  if not found then
    raise exception 'course_not_found' using errcode = 'P0002';
  end if;

  select count(*)::integer
  into taken
  from public.course_registrations r
  where r.course_id = p_course_id;

  seats_left := case when course.seats is null then null
                     else greatest(course.seats - taken, 0) end;

  if exists (
    select 1
    from public.course_registrations r
    where r.course_id = p_course_id
      and r.client_id = p_client_id
  ) then
    outcome := 'already_registered';
    return next;
    return;
  end if;

  if course.status <> 'published'
    or course.type not in ('in_person', 'online_live')
    or course.starts_at is null
    or course.starts_at <= now() then
    outcome := 'closed';
    return next;
    return;
  end if;

  if course.seats is not null and taken >= course.seats then
    outcome := 'full';
    return next;
    return;
  end if;

  insert into public.course_registrations (course_id, client_id)
  values (p_course_id, p_client_id);

  outcome := 'registered';
  if course.seats is not null then
    seats_left := course.seats - taken - 1;
  end if;
  return next;
end;
$$;

revoke all on function public.register_for_course(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.register_for_course(uuid, text) to service_role;

-- The newsletter's double opt-in email (§6.15). The old list plus the new
-- event. email_outbox.event has no check, so it needs no change.
alter table public.email_templates
  drop constraint email_templates_event_check;

alter table public.email_templates
  add constraint email_templates_event_check check (event in (
    'consultation_new', 'consultation_received', 'consultation_assigned',
    'consultation_reply', 'meeting', 'meeting_reminder', 'document_request',
    'document_recommendation', 'document_granted', 'course_registration',
    'custom_training_request', 'contact_message', 'account_new',
    'newsletter_confirm'
  ));

-- One document per stored file (from #70). The dev project had no duplicate
-- keys when this was written.
create unique index documents_storage_key_key on public.documents (storage_key);
