-- Postgres caps a regex repetition at 255, so the original {2,256} failed the moment any outlet
-- saved a UPI ID ("invalid repetition count"). Same rule, with a count Postgres accepts.
alter table public.outlets drop constraint outlets_upi_vpa_check;
alter table public.outlets
  add constraint outlets_upi_vpa_check check (upi_vpa ~ '^[A-Za-z0-9._-]{2,255}@[A-Za-z]{2,64}$');
