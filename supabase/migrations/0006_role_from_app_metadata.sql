-- =====================================================================
-- KRİTİK: Rol ve link bayrağı artık yalnızca app_metadata'dan okunur.
-- user_metadata'yı kayıt olan kişi kendisi doldurabilir (auth.signUp options.data);
-- önceki tetikleyici buradan rol okuduğu için herkes kendini super_admin yapabiliyordu.
-- app_metadata'yı yalnızca service role (sunucu) yazabilir.
-- =====================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_role public.user_role := 'branch_teacher';
begin
  if (new.raw_app_meta_data ->> 'role') in ('super_admin', 'class_teacher', 'branch_teacher') then
    v_role := (new.raw_app_meta_data ->> 'role')::public.user_role;
  end if;

  insert into public.profiles (id, email, full_name, role, branch, via_link)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    v_role,
    new.raw_user_meta_data ->> 'branch',
    coalesce((new.raw_app_meta_data ->> 'via_link')::boolean, false)
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
