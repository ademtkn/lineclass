-- =====================================================================
-- LineClass — ilk şema
-- Supabase SQL Editor'de tek seferde çalıştırılabilir.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tipler
-- ---------------------------------------------------------------------
create type public.user_role as enum ('super_admin', 'class_teacher', 'branch_teacher');
create type public.note_status as enum ('positive', 'neutral', 'concern');
create type public.lang_code as enum ('en', 'ky', 'ru', 'tr');

-- ---------------------------------------------------------------------
-- Tablolar
-- ---------------------------------------------------------------------

-- Users: auth.users ile birebir eşleşen profil tablosu
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '',
  email       text not null unique,
  role        public.user_role not null default 'branch_teacher',
  branch      text,                       -- Branş (Matematik, Fizik, ...)
  created_at  timestamptz not null default now()
);

-- Classes
create table public.classes (
  id                uuid primary key default gen_random_uuid(),
  name              text not null unique,  -- Örn: 5-A
  class_teacher_id  uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now()
);
create index on public.classes (class_teacher_id);

-- Students
create table public.students (
  id          uuid primary key default gen_random_uuid(),
  first_name  text not null,
  last_name   text not null,
  class_id    uuid not null references public.classes (id) on delete cascade,
  photo_url   text,
  short_info  text,
  created_at  timestamptz not null default now()
);
create index on public.students (class_id);

-- Teacher_Class_Access: hangi öğretmen hangi sınıfa giriyor
create table public.teacher_class_access (
  teacher_id  uuid not null references public.profiles (id) on delete cascade,
  class_id    uuid not null references public.classes (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (teacher_id, class_id)
);
create index on public.teacher_class_access (class_id);

-- Notes / Feedbacks
create table public.notes (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.students (id) on delete cascade,
  teacher_id  uuid not null references public.profiles (id) on delete cascade,
  note_text   text not null check (char_length(note_text) between 1 and 4000),
  status      public.note_status not null default 'neutral',
  created_at  timestamptz not null default now()
);
create index on public.notes (student_id, created_at desc);
create index on public.notes (teacher_id);

-- Çeviri önbelleği: aynı not aynı dile ikinci kez çevrilmez (maliyet ↓)
create table public.note_translations (
  note_id     uuid not null references public.notes (id) on delete cascade,
  lang        public.lang_code not null,
  text        text not null,
  created_at  timestamptz not null default now(),
  primary key (note_id, lang)
);

-- ---------------------------------------------------------------------
-- Yeni auth kullanıcısı -> profil satırı
-- (Super admin kullanıcı oluştururken user_metadata'ya full_name/role/branch koyar)
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, branch)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'branch_teacher'),
    new.raw_user_meta_data ->> 'branch'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Yetki yardımcıları (security definer -> RLS özyinelemesini önler)
-- ---------------------------------------------------------------------
create or replace function public.my_role()
returns public.user_role
language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.is_super_admin()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(public.my_role() = 'super_admin', false) $$;

-- Kullanıcı bu sınıfın sınıf öğretmeni mi?
create or replace function public.is_class_teacher_of(p_class_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.classes
    where id = p_class_id and class_teacher_id = auth.uid()
  )
$$;

-- Kullanıcı bu sınıfa derse giriyor mu (atama veya sınıf öğretmenliği)?
create or replace function public.can_access_class(p_class_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_super_admin()
      or public.is_class_teacher_of(p_class_id)
      or exists (
        select 1 from public.teacher_class_access
        where class_id = p_class_id and teacher_id = auth.uid()
      )
$$;

create or replace function public.class_of_student(p_student_id uuid)
returns uuid
language sql stable security definer set search_path = public
as $$ select class_id from public.students where id = p_student_id $$;

-- ---------------------------------------------------------------------
-- Satır düzeyi güvenlik (RLS)
-- ---------------------------------------------------------------------
alter table public.profiles             enable row level security;
alter table public.classes              enable row level security;
alter table public.students             enable row level security;
alter table public.teacher_class_access enable row level security;
alter table public.notes                enable row level security;
alter table public.note_translations    enable row level security;

-- profiles: herkes giriş yapmışsa öğretmen listesini görebilir (atama ekranları için)
create policy "profiles: read for authenticated"
  on public.profiles for select to authenticated using (true);

-- Kişi kendi adını/branşını güncelleyebilir; rolünü değiştiremez
create policy "profiles: update self"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = public.my_role());

create policy "profiles: admin all"
  on public.profiles for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- classes
create policy "classes: read accessible"
  on public.classes for select to authenticated
  using (public.can_access_class(id));

create policy "classes: admin write"
  on public.classes for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- students
create policy "students: read accessible"
  on public.students for select to authenticated
  using (public.can_access_class(class_id));

create policy "students: class teacher / admin write"
  on public.students for all to authenticated
  using (public.is_super_admin() or public.is_class_teacher_of(class_id))
  with check (public.is_super_admin() or public.is_class_teacher_of(class_id));

-- teacher_class_access
create policy "tca: read own or managed"
  on public.teacher_class_access for select to authenticated
  using (
    teacher_id = auth.uid()
    or public.is_super_admin()
    or public.is_class_teacher_of(class_id)
  );

create policy "tca: class teacher / admin write"
  on public.teacher_class_access for all to authenticated
  using (public.is_super_admin() or public.is_class_teacher_of(class_id))
  with check (public.is_super_admin() or public.is_class_teacher_of(class_id));

-- notes
-- Okuma: notu yazan öğretmen, öğrencinin sınıf öğretmeni, super admin
create policy "notes: read"
  on public.notes for select to authenticated
  using (
    teacher_id = auth.uid()
    or public.is_super_admin()
    or public.is_class_teacher_of(public.class_of_student(student_id))
  );

-- Yazma: sadece erişebildiği sınıftaki öğrenciye, kendi adına
create policy "notes: insert own"
  on public.notes for insert to authenticated
  with check (
    teacher_id = auth.uid()
    and public.can_access_class(public.class_of_student(student_id))
  );

create policy "notes: update own"
  on public.notes for update to authenticated
  using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

create policy "notes: delete own or admin"
  on public.notes for delete to authenticated
  using (teacher_id = auth.uid() or public.is_super_admin());

-- note_translations: notu okuyabilen çeviriyi de okur/ekler
create policy "translations: read"
  on public.note_translations for select to authenticated
  using (exists (select 1 from public.notes n where n.id = note_id));

create policy "translations: insert"
  on public.note_translations for insert to authenticated
  with check (exists (select 1 from public.notes n where n.id = note_id));

-- ---------------------------------------------------------------------
-- Öğrenci fotoğrafları için Storage bucket
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('student-photos', 'student-photos', true)
on conflict (id) do nothing;

create policy "student-photos: public read"
  on storage.objects for select
  using (bucket_id = 'student-photos');

create policy "student-photos: admin / class teacher upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'student-photos'
    and public.my_role() in ('super_admin', 'class_teacher')
  );
