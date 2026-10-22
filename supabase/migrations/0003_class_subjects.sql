-- =====================================================================
-- Sınıfın dersleri ve her derse atanan öğretmen.
-- Bir derse öğretmen atamak, o öğretmene sınıf erişimi de verir.
-- =====================================================================

create table public.class_subjects (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references public.classes (id) on delete cascade,
  subject     text not null check (char_length(subject) between 1 and 60),
  teacher_id  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (class_id, subject)
);
create index on public.class_subjects (teacher_id);

alter table public.class_subjects enable row level security;

create policy "class_subjects: read accessible"
  on public.class_subjects for select to authenticated
  using (public.can_access_class(class_id));

create policy "class_subjects: class teacher / admin write"
  on public.class_subjects for all to authenticated
  using (public.is_super_admin() or public.is_class_teacher_of(class_id))
  with check (public.is_super_admin() or public.is_class_teacher_of(class_id));

-- Ders ataması değişince sınıf erişimini senkronla:
--  * yeni öğretmen → erişim eklenir
--  * eski öğretmenin bu sınıfta başka dersi kalmadıysa → erişimi kaldırılır
create or replace function public.sync_subject_access()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') and new.teacher_id is not null then
    insert into public.teacher_class_access (teacher_id, class_id)
    values (new.teacher_id, new.class_id)
    on conflict do nothing;
  end if;

  if tg_op in ('UPDATE', 'DELETE')
     and old.teacher_id is not null
     and (tg_op = 'DELETE' or old.teacher_id is distinct from new.teacher_id)
     and not exists (
       select 1 from public.class_subjects
       where class_id = old.class_id and teacher_id = old.teacher_id
     )
  then
    delete from public.teacher_class_access
    where class_id = old.class_id and teacher_id = old.teacher_id;
  end if;

  return null;
end;
$$;

create trigger class_subjects_sync_access
  after insert or update of teacher_id or delete on public.class_subjects
  for each row execute function public.sync_subject_access();
