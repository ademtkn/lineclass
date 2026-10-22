-- =====================================================================
-- Sınıfa özel davet linki: branş öğretmenleri şifresiz katılır.
-- =====================================================================

-- Her sınıfın tahmin edilemez bir katılım anahtarı var (/join/<token>)
alter table public.classes
  add column join_token text not null unique
  default replace(gen_random_uuid()::text, '-', '');

-- Link ile oluşturulan (şifresiz) öğretmen hesaplarını ayırt etmek için
alter table public.profiles
  add column via_link boolean not null default false;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, branch, via_link)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'branch_teacher'),
    new.raw_user_meta_data ->> 'branch',
    coalesce((new.raw_user_meta_data ->> 'via_link')::boolean, false)
  );
  return new;
end;
$$;

-- Sınıf öğretmeni (veya admin) linki yeniler; eski link anında geçersiz olur.
create or replace function public.regenerate_join_token(p_class_id uuid)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_token text := replace(gen_random_uuid()::text, '-', '');
begin
  if not (public.is_super_admin() or public.is_class_teacher_of(p_class_id)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.classes set join_token = v_token where id = p_class_id;
  return v_token;
end;
$$;

revoke execute on function public.regenerate_join_token(uuid) from public, anon;
grant execute on function public.regenerate_join_token(uuid) to authenticated;
