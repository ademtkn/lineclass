-- =====================================================================
-- 1) Notlar derse bağlanır (notes.subject_id).
-- 2) Not yazan öğretmen notu sonradan değiştiremez/silemez; yalnızca sınıf öğretmeni (ve yönetici).
-- 3) Linkle katılan öğretmenin adı ilk girdiği cihaza kilitlenir (başkası aynı adla giremesin).
-- =====================================================================

-- ---------------------------------------------------------------- 1) not -> ders
alter table public.notes
  add column subject_id uuid references public.class_subjects (id) on delete set null;
create index on public.notes (subject_id);

-- Not, öğrencinin sınıfındaki bir derse bağlanabilir: ya öğretmen o dersin öğretmenidir ya da sınıf öğretmenidir
create or replace function public.valid_note_subject(p_student_id uuid, p_subject_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select p_subject_id is null or exists (
    select 1 from public.class_subjects cs
    where cs.id = p_subject_id
      and cs.class_id = public.class_of_student(p_student_id)
      and (cs.teacher_id = auth.uid() or public.is_class_teacher_of(cs.class_id))
  )
$$;
revoke execute on function public.valid_note_subject(uuid, uuid) from public, anon;
grant execute on function public.valid_note_subject(uuid, uuid) to authenticated;

drop policy "notes: insert own" on public.notes;
create policy "notes: insert own"
  on public.notes for insert to authenticated
  with check (
    teacher_id = auth.uid()
    and public.can_access_class(public.class_of_student(student_id))
    and public.student_is_active(student_id)
    and public.valid_note_subject(student_id, subject_id)
  );

-- ---------------------------------------------------------------- 2) not değiştirme/silme
drop policy "notes: update own" on public.notes;
drop policy "notes: delete own or admin" on public.notes;

create policy "notes: class teacher update"
  on public.notes for update to authenticated
  using (public.is_class_teacher_of(public.class_of_student(student_id)) or public.is_super_admin())
  with check (public.is_class_teacher_of(public.class_of_student(student_id)) or public.is_super_admin());

create policy "notes: class teacher delete"
  on public.notes for delete to authenticated
  using (public.is_class_teacher_of(public.class_of_student(student_id)) or public.is_super_admin());

-- Yalnızca metin ve durum değiştirilebilir (yazar, öğrenci, tarih, ders sabit kalır)
revoke update on public.notes from anon, authenticated;
grant update (note_text, status) on public.notes to authenticated;

-- ---------------------------------------------------------------- 3) cihaz kilidi
create table public.link_claims (
  teacher_id  uuid primary key references public.profiles (id) on delete cascade,
  token_hash  text not null,
  claimed_at  timestamptz not null default now()
);
alter table public.link_claims enable row level security;
revoke all on public.link_claims from anon, authenticated;
