create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  email text not null,
  city text not null default 'Almaty',
  elo jsonb not null default '{"classic":1200,"switch":1200,"fog":1200,"chaos":1200,"team":1200,"speed":1200}',
  coins integer not null default 0,
  skin_equipped text not null default 'classic',
  wins integer not null default 0,
  losses integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  mode text not null default 'classic',
  white_player_id uuid references public.users(id) on delete set null,
  black_player_id uuid references public.users(id) on delete set null,
  ai_opponent boolean not null default false,
  ai_difficulty text,
  fen text not null default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  moves_pgn text not null default '',
  moves_san text not null default '',
  result text,
  status text not null default 'active',
  draw_offered_by uuid references public.users(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

alter table public.games
  drop constraint if exists games_mode_check;

alter table public.games add column if not exists ai_opponent boolean not null default false;
alter table public.games add column if not exists ai_difficulty text;
alter table public.games add column if not exists fen text not null default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
alter table public.games add column if not exists moves_san text not null default '';
alter table public.games add column if not exists status text not null default 'active';
alter table public.games add column if not exists draw_offered_by uuid references public.users(id) on delete set null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'games'
      and column_name = 'moves_san'
      and data_type = 'jsonb'
  ) then
    alter table public.games
      alter column moves_san type text
      using replace(replace(trim(both '[]' from moves_san::text), '","', ' '), '"', '');
  end if;
end $$;

alter table public.games
  add constraint games_mode_check
  check (mode in ('classic','local_multiplayer','switch','switch_places','fog','fog_of_war','chaos','chaos_mode','team','team_2v2','speed','speed_chess','blind','blind_chess','roulette','chess_roulette'));

alter table public.games
  drop constraint if exists games_ai_difficulty_check;

alter table public.games
  add constraint games_ai_difficulty_check
  check (ai_difficulty is null or ai_difficulty in ('Easy','Medium','Hard'));

alter table public.games
  drop constraint if exists games_status_check;

alter table public.games
  add constraint games_status_check
  check (status in ('waiting_for_opponent','active','finished','abandoned'));

alter table public.games
  drop constraint if exists games_result_check;

alter table public.games
  add constraint games_result_check
  check (result is null or result in ('white_win','black_win','draw','resigned'));

create table if not exists public.game_players (
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  team text not null check (team in ('white','black')),
  piece_group text not null check (piece_group in ('major','minor')),
  connected_at timestamptz not null default now(),
  primary key (game_id, user_id)
);

create table if not exists public.shop_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null,
  price_coins integer,
  price_usd numeric(8, 2),
  created_at timestamptz not null default now()
);

create table if not exists public.user_inventory (
  user_id uuid not null references public.users(id) on delete cascade,
  item_id uuid not null references public.shop_items(id) on delete cascade,
  purchased_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

create table if not exists public.game_rooms (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.users(id) on delete cascade,
  game_mode text not null,
  difficulty text,
  is_private boolean not null default false,
  password text,
  max_players integer not null default 2,
  current_players integer not null default 1,
  status text not null default 'waiting',
  fen text not null default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  moves_pgn text not null default '',
  moves_san text not null default '',
  result text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz
);

alter table public.game_rooms add column if not exists fen text not null default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
alter table public.game_rooms add column if not exists moves_pgn text not null default '';
alter table public.game_rooms add column if not exists moves_san text not null default '';
alter table public.game_rooms add column if not exists result text;

create table if not exists public.room_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  team text,
  joined_at timestamptz not null default now(),
  unique (room_id, user_id)
);

alter table public.game_rooms
  drop constraint if exists game_rooms_status_check;

alter table public.game_rooms
  add constraint game_rooms_status_check
  check (status in ('waiting','playing','finished'));

create or replace view public.leaderboard as
select
  id,
  username,
  city,
  elo,
  coins,
  wins,
  losses,
  dense_rank() over (order by ((elo ->> 'classic')::integer) desc) as classic_rank
from public.users;

alter table public.users enable row level security;
alter table public.games enable row level security;
alter table public.game_players enable row level security;
alter table public.shop_items enable row level security;
alter table public.user_inventory enable row level security;
alter table public.game_rooms enable row level security;
alter table public.room_players enable row level security;

drop policy if exists "profiles are readable" on public.users;
drop policy if exists "users insert own profile" on public.users;
drop policy if exists "users update own profile" on public.users;
drop policy if exists "games visible to participants" on public.games;
drop policy if exists "authenticated users create games" on public.games;
drop policy if exists "participants update games" on public.games;
drop policy if exists "game players visible to room" on public.game_players;
drop policy if exists "authenticated users join game" on public.game_players;
drop policy if exists "shop is public" on public.shop_items;
drop policy if exists "users read own inventory" on public.user_inventory;
drop policy if exists "users buy into own inventory" on public.user_inventory;
drop policy if exists "rooms are readable" on public.game_rooms;
drop policy if exists "users create rooms" on public.game_rooms;
drop policy if exists "room owners update rooms" on public.game_rooms;
drop policy if exists "room players are readable" on public.room_players;
drop policy if exists "users join rooms" on public.room_players;

create policy "profiles are readable"
on public.users for select
using (true);

create policy "users insert own profile"
on public.users for insert
with check (auth.uid() = id);

create policy "users update own profile"
on public.users for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "games visible to participants"
on public.games for select
using (
  mode = 'local_multiplayer'
  or auth.uid() = white_player_id
  or auth.uid() = black_player_id
  or exists (
    select 1 from public.game_players
    where game_players.game_id = games.id
      and game_players.user_id = auth.uid()
  )
);

create policy "authenticated users create games"
on public.games for insert
with check (
  auth.role() = 'authenticated'
  and (auth.uid() = white_player_id or auth.uid() = black_player_id)
);

create policy "participants update games"
on public.games for update
using (
  (
    mode = 'local_multiplayer'
    and auth.uid() = white_player_id
  )
  or (
    mode <> 'local_multiplayer'
    and (
      auth.uid() = white_player_id
      or auth.uid() = black_player_id
      or exists (
        select 1 from public.game_players
        where game_players.game_id = games.id
          and game_players.user_id = auth.uid()
      )
    )
  )
)
with check (
  (
    mode = 'local_multiplayer'
    and auth.uid() = white_player_id
  )
  or (
    mode <> 'local_multiplayer'
    and (
      auth.uid() = white_player_id
      or auth.uid() = black_player_id
      or exists (
        select 1 from public.game_players
        where game_players.game_id = games.id
          and game_players.user_id = auth.uid()
      )
    )
  )
);

create policy "game players visible to room"
on public.game_players for select
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.game_players gp
    where gp.game_id = game_players.game_id
      and gp.user_id = auth.uid()
  )
);

create policy "authenticated users join game"
on public.game_players for insert
with check (auth.uid() = user_id);

create policy "shop is public"
on public.shop_items for select
using (true);

create policy "users read own inventory"
on public.user_inventory for select
using (auth.uid() = user_id);

create policy "users buy into own inventory"
on public.user_inventory for insert
with check (auth.uid() = user_id);

create policy "rooms are readable"
on public.game_rooms for select
using (is_private = false or created_by = auth.uid());

create policy "users create rooms"
on public.game_rooms for insert
with check (auth.uid() = created_by);

create policy "room owners update rooms"
on public.game_rooms for update
using (
  created_by = auth.uid()
  or exists (
    select 1 from public.room_players
    where room_players.room_id = game_rooms.id
      and room_players.user_id = auth.uid()
  )
)
with check (
  created_by = auth.uid()
  or exists (
    select 1 from public.room_players
    where room_players.room_id = game_rooms.id
      and room_players.user_id = auth.uid()
  )
);

create policy "room players are readable"
on public.room_players for select
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.game_rooms
    where game_rooms.id = room_players.room_id
      and (game_rooms.is_private = false or game_rooms.created_by = auth.uid())
  )
);

create policy "users join rooms"
on public.room_players for insert
with check (auth.uid() = user_id);

insert into public.shop_items (name, type, price_coins, price_usd)
values
  ('Neon Skin Pack', 'piece_skin', 450, null),
  ('Gold Skin Pack', 'piece_skin', 900, null),
  ('Wooden Skin Pack', 'piece_skin', 300, null),
  ('Tengri Blue Skin Pack', 'piece_skin', 720, null),
  ('Steppe Nomad Skin Pack', 'piece_skin', 680, null),
  ('Yurt Ivory Skin Pack', 'piece_skin', 760, null),
  ('Cyberpunk Board', 'board_theme', 1200, null),
  ('ChaosMate Pro', 'subscription', null, 9.00)
on conflict do nothing;
