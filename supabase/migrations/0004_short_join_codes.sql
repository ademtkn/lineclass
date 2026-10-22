-- =====================================================================
-- Kısa, okunabilir davet kodu: <sınıf>-<7 rastgele karakter>, örn. 5a-k7m2qxp
-- Karıştırılabilen karakterler (0/o, 1/l/i) kullanılmaz.
-- DİKKAT: Mevcut sınıfların linkleri yenilenir; eski uzun linkler çalışmaz.
-- =====================================================================

create or replace function public.gen_join_code(p_name text)
returns text
language plpgsql
volatile
set search_path = public, extensions
as $$
declare
  alphabet constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  slug text;
  code text;
  i int;
begin
  slug := lower(regexp_replace(
    translate(coalesce(p_name, ''), 'ÇĞİIÖŞÜçğıöşüАаЕеОоРрСсУуХх', 'CGIIOSUcgiosuAaEeOoPpCcYyXx'),
    '[^A-Za-z0-9]', '', 'g'));
  slug := left(slug, 10);
  if slug = '' then slug := 'sinif'; end if;

  loop
    code := slug || '-';
    for i in 1..7 loop
      code := code || substr(alphabet, 1 + (get_byte(gen_random_bytes(1), 0) % length(alphabet)), 1);
    end loop;
    exit when not exists (select 1 from public.classes where join_token = code);
  end loop;
  return code;
end;
$$;

-- Yeni sınıflar kodu tetikleyiciden alır (varsayılan değer sınıf adına erişemez)
alter table public.classes alter column join_token drop default;

create or replace function public.set_join_code()
returns trigger
language plpgsql
as $$
begin
  if new.join_token is null then
    new.join_token := public.gen_join_code(new.name);
  end if;
  return new;
end;
$$;

create trigger classes_set_join_code
  before insert on public.classes
  for each row execute function public.set_join_code();

update public.classes set join_token = public.gen_join_code(name);

create or replace function public.regenerate_join_token(p_class_id uuid)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_token text;
begin
  if not (public.is_super_admin() or public.is_class_teacher_of(p_class_id)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.classes
     set join_token = public.gen_join_code(name)
   where id = p_class_id
  returning join_token into v_token;
  return v_token;
end;
$$;
