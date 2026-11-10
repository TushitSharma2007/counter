-- The app has no item photos (owner decision, 2026-11-10). Remove the unused column so nobody
-- builds on it by accident.
alter table public.items drop column image_path;
