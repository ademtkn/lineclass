-- =====================================================================
-- 1) Öğrenci aktif/pasif: pasif öğrenci listelerde görünmez ama silinmez (sonra tekrar aktif edilebilir).
-- 2) Sınıf adı artık yalnızca aynı sınıf öğretmeninin sınıfları arasında tekil
--    (farklı okullardan iki öğretmen de "5-A" açabilsin).
-- 3) Sınıf öğretmeni başvuruları: herkese açık form -> yönetici onayı.
-- =====================================================================

-- ---------------------------------------------------------------- 1) aktif/pasif
alter table public.students add column active boolean not null default true;
create index on public.students (class_id) where active;

create or replace function public.student_is_active(p_student_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce((select active from public.students where id = p_student_id), false) $$;
revoke execute on function public.student_is_active(uuid) from public, anon;
grant execute on function public.student_is_active(uuid) to authenticated;

-- Pasif öğrenciye yeni not yazılamaz (okuma/silme etkilenmez)
drop policy "notes: insert own" on public.notes;
create policy "notes: insert own"
  on public.notes for insert to authenticated
  with check (
    teacher_id = auth.uid()
    and public.can_access_class(public.class_of_student(student_id))
    and public.student_is_active(student_id)
  );

-- ---------------------------------------------------------------- 2) sınıf adı tekilliği
alter table public.classes drop constraint classes_name_key;
alter table public.classes add constraint classes_teacher_name_key unique (class_teacher_id, name);

-- ---------------------------------------------------------------- 3) başvurular
create type public.application_status as enum ('pending', 'approved', 'rejected');

create table public.teacher_applications (
  id           uuid primary key default gen_random_uuid(),
  full_name    text not null check (char_length(full_name) between 3 and 120),
  email        text not null check (char_length(email) between 5 and 200),
  phone        text not null check (char_length(phone) between 5 and 40),
  school       text not null check (char_length(school) between 2 and 160),
  class_name   text not null check (char_length(class_name) between 1 and 40),
  city         text check (char_length(city) <= 80),
  address      text not null check (char_length(address) between 5 and 400),
  message      text check (char_length(message) <= 1000),
  status       public.application_status not null default 'pending',
  user_id      uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz
);
create index on public.teacher_applications (status, created_at desc);
create unique index teacher_applications_one_pending_per_email
  on public.teacher_applications (lower(email)) where status = 'pending';

-- Yalnızca sunucu (service role) okur/yazar: istemci rolleri için politika yok, yetki de yok.
alter table public.teacher_applications enable row level security;
revoke all on public.teacher_applications from anon, authenticated;
