-- ═══════════════════════════════════════════════════════════════
--  WatchFlow — schéma Supabase
--  À coller en entier dans  Supabase → SQL Editor → New query → Run.
--  Peut être relancé sans risque (idempotent).
--  Chaque ligne appartient à un utilisateur (user_id) et n'est visible
--  que par lui grâce aux règles RLS ci-dessous.
-- ═══════════════════════════════════════════════════════════════

-- ── Réglages (capital de départ) ──
create table if not exists public.settings (
  user_id          uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  starting_capital numeric(12,2),
  updated_at       timestamptz not null default now()
);

-- ── Montres ──
create table if not exists public.watches (
  id            uuid primary key,
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  brand         text not null default '',
  model         text not null default '',
  reference     text default '',
  period        text default '',
  movement      text default '',
  case_info     text default '',
  condition     text default '',
  accessories   text default '',
  source        text default '',
  bought_at     date,
  expected_at   date,
  status        text not null default 'recue',
  asking_price  numeric(12,2),
  buy_price     numeric(12,2) not null default 0,
  buy_fees      numeric(12,2) not null default 0,
  buy_ship      numeric(12,2) not null default 0,
  notes         text default '',
  listings      jsonb not null default '[]'::jsonb,
  listed_at     date,
  sale_price    numeric(12,2),
  sale_platform text,
  sale_fees     numeric(12,2),
  sale_ship     numeric(12,2),
  sold_at       date,
  paid_at       date,
  photo_path    text,
  thumb         text,
  created_at    timestamptz not null default now()
);

-- ── Travaux / interventions ──
create table if not exists public.repairs (
  id         uuid primary key,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  watch_id   uuid not null references public.watches(id) on delete cascade,
  label      text not null,
  cost       numeric(12,2) not null default 0,
  done_at    date,
  created_at timestamptz not null default now()
);

-- ── Ledger : tous les mouvements d'argent ──
create table if not exists public.movements (
  id         uuid primary key,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  watch_id   uuid references public.watches(id) on delete cascade,
  kind       text not null default 'manual',   -- purchase | shipping | repair | sale | sale_ship | manual
  label      text not null,
  amount     numeric(12,2) not null,           -- positif = entrée, négatif = sortie
  date       date not null default current_date,
  pending    boolean not null default false,   -- vente pas encore encaissée
  created_at timestamptz not null default now()
);

-- ── Journal d'activité ──
create table if not exists public.events (
  id         uuid primary key,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  watch_id   uuid references public.watches(id) on delete cascade,
  label      text not null,
  amount     numeric(12,2),
  at         date not null default current_date,
  created_at timestamptz not null default now()
);

-- ── Actions à faire ──
create table if not exists public.tasks (
  id         uuid primary key,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  watch_id   uuid references public.watches(id) on delete cascade,
  label      text not null,
  done       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists watches_user_idx   on public.watches(user_id);
create index if not exists repairs_watch_idx  on public.repairs(watch_id);
create index if not exists movements_user_idx on public.movements(user_id, date);
create index if not exists events_user_idx    on public.events(user_id, at);
create index if not exists tasks_user_idx     on public.tasks(user_id);

-- ── Sécurité : chaque utilisateur ne voit / ne modifie que ses lignes ──
do $$
declare t text;
begin
  foreach t in array array['settings','watches','repairs','movements','events','tasks'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "owner_all" on public.%I', t);
    execute format('create policy "owner_all" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- ── Photos : bucket privé, un dossier par utilisateur ──
insert into storage.buckets (id, name, public)
values ('watch-photos', 'watch-photos', false)
on conflict (id) do nothing;

drop policy if exists "photos_select_own" on storage.objects;
drop policy if exists "photos_insert_own" on storage.objects;
drop policy if exists "photos_update_own" on storage.objects;
drop policy if exists "photos_delete_own" on storage.objects;

create policy "photos_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'watch-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photos_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'watch-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photos_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'watch-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photos_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'watch-photos' and (storage.foldername(name))[1] = auth.uid()::text);
