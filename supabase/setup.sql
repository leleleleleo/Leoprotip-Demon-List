-- Pega todo esto en Supabase > SQL Editor > New query > Run
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  nickname text not null check (char_length(nickname) between 1 and 60),
  progress int not null check (progress between 1 and 100),
  level_name text not null check (char_length(level_name) between 1 and 100),
  level_id text not null check (level_id ~ '^[0-9]{1,12}$'),
  password text check (char_length(password) <= 40),
  creators text check (char_length(creators) <= 200),
  verifier text check (char_length(verifier) <= 60),
  publisher text check (char_length(publisher) <= 60),
  video text not null check (video ~* '^https?://' and char_length(video) <= 300),
  channel text check (char_length(channel) <= 300),
  hz int check (hz between 1 and 1000)
);

alter table public.submissions enable row level security;

-- Cualquiera puede ENVIAR (solo insertar, siempre como pendiente)
create policy "cualquiera envia" on public.submissions
  for insert to anon with check (status = 'pending');

-- Solo el staff con login puede ver, cambiar y borrar
create policy "staff lee" on public.submissions
  for select to authenticated using (true);
create policy "staff edita" on public.submissions
  for update to authenticated using (true) with check (true);
create policy "staff borra" on public.submissions
  for delete to authenticated using (true);

revoke all on public.submissions from anon, authenticated;
grant insert on public.submissions to anon;
grant select, update, delete on public.submissions to authenticated;
