-- =====================================================================
-- Güvenlik sağlamlaştırma (scripts/security-test.mjs ile doğrulanır)
-- =====================================================================

-- 1) Yardımcı fonksiyonlar API üzerinden (rpc) girişsiz çağrılamasın.
--    RLS politikaları bunları giriş yapmış kullanıcı adına çalıştırdığı için authenticated'da kalır.
revoke execute on function public.my_role()                    from public, anon;
revoke execute on function public.is_super_admin()             from public, anon;
revoke execute on function public.is_class_teacher_of(uuid)    from public, anon;
revoke execute on function public.can_access_class(uuid)       from public, anon;
revoke execute on function public.class_of_student(uuid)       from public, anon;
grant  execute on function public.my_role(), public.is_super_admin(), public.is_class_teacher_of(uuid),
                           public.can_access_class(uuid), public.class_of_student(uuid) to authenticated;

-- Davet kodu üretici yalnızca DB içinden (tetikleyici / regenerate) kullanılır
alter function public.set_join_code() security definer set search_path = public;
revoke execute on function public.gen_join_code(text) from public, anon, authenticated;
revoke execute on function public.set_join_code()    from public, anon, authenticated;
revoke execute on function public.sync_subject_access() from public, anon, authenticated;
revoke execute on function public.handle_new_user()  from public, anon, authenticated;

-- 2) profiles: e-posta API'den okunamaz/değiştirilemez (davet girişleri e-postaya dayanır).
--    Kişi yalnızca adını ve branşını; admin ayrıca rolü değiştirebilir (RLS satırları sınırlar).
revoke select, insert, update, delete on public.profiles from anon, authenticated;
grant select (id, full_name, role, branch, via_link, created_at) on public.profiles to authenticated;
grant update (full_name, branch, role) on public.profiles to authenticated;

-- 3) Çeviri önbelleğine yalnızca sunucu (service role) yazar: sahte çeviri enjekte edilemez
drop policy if exists "translations: insert" on public.note_translations;
revoke insert, update, delete on public.note_translations from anon, authenticated;

-- 4) Fotoğraflar: sadece görsel türleri, en fazla 5 MB; yükleme yalnızca kendi sınıfının klasörüne
update storage.buckets
   set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif'],
       file_size_limit = 5 * 1024 * 1024
 where id = 'student-photos';

create or replace function public.can_upload_class_photo(p_path text)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
  v_folder text := split_part(p_path, '/', 1);
begin
  if v_folder !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.is_super_admin() or public.is_class_teacher_of(v_folder::uuid);
end;
$$;
revoke execute on function public.can_upload_class_photo(text) from public, anon;
grant execute on function public.can_upload_class_photo(text) to authenticated;

drop policy if exists "student-photos: admin / class teacher upload" on storage.objects;
create policy "student-photos: upload to own class folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'student-photos'
    and public.can_upload_class_photo(name)
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif')
  );
