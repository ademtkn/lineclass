-- =====================================================================
-- Görev dağılımı:
--  * Sınıfı sınıf öğretmeni kendisi oluşturur, adını değiştirir, siler (yalnızca kendi sınıfı).
--  * Ders adları 4 dilde tutulur (class_subjects.names: {"tr","en","ky","ru"}).
--  * Admin yalnızca kullanıcıları yönetir (uygulama tarafı; DB'de mevcut yetkileri kalır).
-- =====================================================================

-- 4 dilli ders adları
alter table public.class_subjects
  add column if not exists names jsonb not null default '{}'::jsonb;

-- Sınıf öğretmeni kendi sınıfını açar / yönetir
create policy "classes: class teacher insert own"
  on public.classes for insert to authenticated
  with check (class_teacher_id = auth.uid() and public.my_role() = 'class_teacher');

create policy "classes: class teacher update own"
  on public.classes for update to authenticated
  using (public.is_class_teacher_of(id))
  with check (class_teacher_id = auth.uid());

create policy "classes: class teacher delete own"
  on public.classes for delete to authenticated
  using (public.is_class_teacher_of(id));

-- Sütun yetkileri: istemci yalnızca ad (ve eklerken sahibini) yazabilir.
-- Davet kodunu (join_token) hiçbir istemci belirleyemez; yalnızca tetikleyici / regenerate üretir.
revoke insert, update on public.classes from anon, authenticated;
grant insert (name, class_teacher_id) on public.classes to authenticated;
grant update (name) on public.classes to authenticated;

-- Davet kodu her eklemede sunucuda üretilir (istemcinin gönderdiği değer yok sayılır)
create or replace function public.set_join_code()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  new.join_token := public.gen_join_code(new.name);
  return new;
end;
$$;
revoke execute on function public.set_join_code() from public, anon, authenticated;

-- Yeni eklenen satır, aynı komuttaki RETURNING için can_access_class() ile henüz görünmez;
-- sınıf öğretmeni kendi sınıfını doğrudan sütundan okuyabilsin.
create policy "classes: class teacher read own"
  on public.classes for select to authenticated
  using (class_teacher_id = auth.uid());
