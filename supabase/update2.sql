-- Pega esto en Supabase > SQL Editor > New query > Run  (solo una vez)

-- 1) Columna nueva: ¿jugó en móvil?
alter table public.submissions add column if not exists mobile boolean not null default false;

-- 2) Lista pública de pendientes: solo muestra nickname, progreso, nivel y fecha.
--    (NO muestra links, passwords, ids ni nada más.)
create or replace view public.pending_public as
  select nickname, progress, level_name, created_at
  from public.submissions
  where status = 'pending'
  order by created_at desc
  limit 50;

grant select on public.pending_public to anon, authenticated;
