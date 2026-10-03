-- Promote a profile to 'active' once its email is confirmed (the signup trigger
-- only catches the moment of insert; later/admin confirmations were left at
-- 'pending_verification'). Exception-wrapped so it can never break the auth flow.
create or replace function public.activate_on_email_confirm()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    if NEW.email_confirmed_at is not null and OLD.email_confirmed_at is null then
      update public.profiles set status = 'active', updated_at = now()
       where id = NEW.id and status = 'pending_verification';
    end if;
  exception when others then
    null;
  end;
  return NEW;
end; $$;

drop trigger if exists trg_activate_on_email_confirm on auth.users;
create trigger trg_activate_on_email_confirm
after update of email_confirmed_at on auth.users
for each row execute function public.activate_on_email_confirm();

-- Backfill: confirmed accounts still marked pending_verification.
update public.profiles p set status = 'active', updated_at = now()
from auth.users u
where u.id = p.id
  and u.email_confirmed_at is not null
  and p.status = 'pending_verification';
