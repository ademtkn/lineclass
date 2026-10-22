-- =====================================================================
-- GoTrue, admin.createUser'da app_metadata'yı kullanıcıyı ekledikten SONRA ayrı bir
-- UPDATE ile yazar; bu yüzden INSERT tetikleyicisi rolü göremez (herkes branch_teacher olur).
-- app_metadata'daki rol / via_link değiştiğinde profili güncelle. Bu alanı yalnızca
-- service role yazabildiği için güvenlidir. Değişmeyen güncellemeler (girişte vb.)
-- admin'in arayüzden verdiği rolü EZMEZ.
-- =====================================================================

create or replace function public.sync_profile_from_app_metadata()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if (new.raw_app_meta_data ->> 'role') is distinct from (old.raw_app_meta_data ->> 'role')
     and (new.raw_app_meta_data ->> 'role') in ('super_admin', 'class_teacher', 'branch_teacher') then
    update public.profiles
       set role = (new.raw_app_meta_data ->> 'role')::public.user_role
     where id = new.id;
  end if;

  if (new.raw_app_meta_data ->> 'via_link') is distinct from (old.raw_app_meta_data ->> 'via_link') then
    update public.profiles
       set via_link = coalesce((new.raw_app_meta_data ->> 'via_link')::boolean, false)
     where id = new.id;
  end if;

  return new;
end;
$$;

revoke execute on function public.sync_profile_from_app_metadata() from public, anon, authenticated;

create trigger on_auth_user_app_metadata_updated
  after update of raw_app_meta_data on auth.users
  for each row execute function public.sync_profile_from_app_metadata();

-- 0006'dan sonra oluşturulup yanlışlıkla branch_teacher kalan hesapları düzelt
update public.profiles p
   set role = (u.raw_app_meta_data ->> 'role')::public.user_role,
       via_link = coalesce((u.raw_app_meta_data ->> 'via_link')::boolean, p.via_link)
  from auth.users u
 where u.id = p.id
   and (u.raw_app_meta_data ->> 'role') in ('super_admin', 'class_teacher', 'branch_teacher')
   and p.role::text is distinct from (u.raw_app_meta_data ->> 'role');
