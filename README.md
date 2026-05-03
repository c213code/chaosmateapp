# ChaosMate

## Описание продукта

ChaosMate - это современная шахматная веб-платформа, где классические шахматы превращаются в более социальный, соревновательный и виральный игровой сервис. Я делал проект не как обычную шахматную доску, а как прототип стартапа: с авторизацией, профилем, ELO, coins, магазином, подписками, локальными KZ-элементами, онлайн-комнатами по ссылке и необычными режимами игры.

Главная идея ChaosMate: дать игрокам больше причин возвращаться, чем просто "сыграть одну партию". Здесь есть прогресс, лидерборд, косметика, будущие турниры, режимы для контента и механики, которые создают неожиданные моменты в игре.

## Для кого это

Продукт рассчитан на студентов, молодых игроков, шахматные клубы и casual-аудиторию, которой нравятся шахматы, но хочется чего-то более свежего, чем стандартный online chess. Отдельный фокус сделан на Казахстан: лидерборд по городам, локальные визуальные мотивы, KZ-стиль скинов и идея локального competitive scene.

## Что уже сделано

- Полноценная шахматная логика через `chess.js`: легальные ходы, шах, мат, пат, рокировка, promotion.
- Classic vs AI с интеграцией Stockfish.
- Онлайн-игра с другом по ссылке через комнаты и синхронизацию состояния.
- Профиль игрока, статистика, coins, wins/losses и per-mode ELO.
- Kazakhstan leaderboard с городами.
- Магазин с piece skins, board themes, emotes, coin packs и subscription plans.
- Бесплатная TESTER-подписка для проверки Pro-функций.
- AI Coach в профиле, который анализирует сохранённые партии прямо рядом с выбранной игрой.
- Турнирные объявления: weekly arena при 100 активных игроках и отдельный offline tournament 19 мая 2026 для игроков с ELO 2000+.

## Уникальные режимы

Я добавил режимы, которые отличают ChaosMate от обычных шахматных сайтов:

- **Switch Places** - каждые 5-10 ходов управление и перспектива меняются. Игрок должен адаптироваться к позиции с другой стороны.
- **2v2 Team Chess** - командные шахматы, где игроки делят контроль над группами фигур.
- **Chaos Mode** - фигуры могут телепортироваться, создавая неожиданные ситуации.
- **Fog of War** - видимость зависит от зоны контроля фигур, поэтому игра становится ближе к strategy game.
- **Speed Chess** - быстрые партии с таймером.
- **Blind Chess** - доска показывается на 3 секунды, потом исчезает, а игрок вводит ходы по памяти.
- **Chess Roulette** - каждые 7-10 ходов происходит случайное событие: bomb, ghost mode, tornado, swap pieces и другие эффекты.

Switch Places, 2v2 Team Chess, Chaos Mode, Blind Chess и Chess Roulette показывают креативность проекта: это не копия Chess.com, а попытка придумать новые игровые сценарии вокруг шахмат.

## Почему это отличается от других

Большинство шахматных сайтов дают только классическую партию, puzzle или рейтинг. ChaosMate строится вокруг идеи "шахматы как продукт":

- В игре есть необычные режимы, которые могут стать TikTok/YouTube-контентом.
- Есть локальная KZ-идентичность: города, визуальные мотивы, скины и лидерборд.
- Есть социальный слой: игра с другом по ссылке, таблицы лидеров, будущие турниры.
- Есть экономика: coins, магазин, subscription, paid cosmetics.
- Есть retention: игроку есть зачем возвращаться - поднять ELO, открыть скин, попасть в турнир, получить badge.

## Монетизация

ChaosMate уже спроектирован с бизнес-мышлением:

- **Subscriptions** - некоторые самые интересные режимы, например Blind Chess и Chess Roulette, доступны только с подпиской.
- **Skins** - игроки могут покупать визуальные стили фигур, включая локальные KZ-скины: Tengri Blue, Steppe Nomad, Yurt Ivory.
- **Board themes** - кастомные доски для персонализации.
- **Coins** - внутренняя валюта для косметики, emotes и будущих турнирных entry.
- **Tournaments** - weekly arena с entry fee `$2.99` или `500 coins`.

Скины и кастомизация важны не только визуально: они дают игроку чувство статуса, особенно в онлайн-комнатах, лидерборде и турнирах.

## Вовлечённость и рост

В продукт добавлена идея роста через competitive scene:

- Когда платформа достигнет 100 активных игроков, откроется Weekend Arena.
- Игроки смогут приглашать друзей и получать 1 free tournament entry.
- Еженедельные турниры будут мотивировать игроков прокачивать ELO.
- Offline tournament 19 мая 2026 будет отдельным большим событием, куда допускаются только игроки с ChaosMate ELO 2000+.
- City leaderboard создаёт локальную конкуренцию: Алматы против Астаны, Шымкент против Караганды и т.д.

Такой подход помогает создать не просто приложение, а community вокруг игры.

## Tech Stack

Next.js 14, TypeScript, React, Supabase, Stockfish.js, chess.js, Tailwind CSS, Socket.io.

## Запуск локально

```bash
npm install
npm run dev
```

Для подключения Supabase нужно создать `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

# English Version

## Product Description

ChaosMate is a modern chess web platform that turns classical chess into a more social, competitive, and viral game experience. I built it not as a simple chess board, but as a startup-style prototype with authentication, profiles, ELO, coins, a shop, subscriptions, Kazakhstan-inspired visuals, online rooms by link, and unique game modes.

The main idea is simple: players should have more reasons to come back than just playing one normal chess game. ChaosMate adds progression, leaderboards, cosmetics, tournaments, viral modes, and unexpected gameplay moments.

## Target Audience

ChaosMate is built for students, young chess players, chess clubs, and casual gamers who like chess but want something fresher than a standard online chess clone. The product also has a Kazakhstan-first angle with city leaderboards, local visual identity, KZ-themed skins, and a future local competitive scene.

## What I Built

- Full chess move validation with `chess.js`.
- Classic vs AI mode with Stockfish.
- Online rooms by link for playing with a friend.
- Player profile, stats, coins, wins/losses, and per-mode ELO.
- Kazakhstan leaderboard by city.
- Shop with piece skins, board themes, emotes, coin packs, and subscriptions.
- Free TESTER subscription for checking Pro-gated features.
- AI Coach analysis inside the profile page.
- Tournament announcements: weekly arena at 100 active players and a separate offline tournament on May 19, 2026 for ELO 2000+ players.

## Unique Game Modes

- **Switch Places** - every 5-10 moves, control and perspective change.
- **2v2 Team Chess** - team chess where players split control of piece groups.
- **Chaos Mode** - pieces can teleport and create unexpected positions.
- **Fog of War** - visibility depends on piece control zones.
- **Speed Chess** - fast games with pressure timers.
- **Blind Chess** - the board is shown for 3 seconds, then hidden; players type moves from memory.
- **Chess Roulette** - random mid-game effects such as bomb, ghost mode, tornado, and swap pieces.

These modes show the creative direction of ChaosMate. It is not just a copy of existing chess websites; it explores new ways to make chess more entertaining, social, and shareable.

## Why It Is Different

Most chess websites focus on standard games, puzzles, or ratings. ChaosMate is designed as a product:

- Unique modes create viral moments.
- Kazakhstan-first identity makes the platform feel local and personal.
- Social layer includes rooms by link, leaderboards, and future tournaments.
- Monetization is built in through coins, cosmetics, and subscriptions.
- Retention comes from ELO, badges, skins, tournaments, and competitive goals.

## Monetization

ChaosMate includes several monetization paths:

- **Subscriptions** - the most viral modes, such as Blind Chess and Chess Roulette, are available only with a subscription.
- **Skins** - players can buy piece styles, including KZ-themed skins: Tengri Blue, Steppe Nomad, and Yurt Ivory.
- **Board themes** - custom boards for personalization.
- **Coins** - internal currency for cosmetics, emotes, and future tournament entries.
- **Tournaments** - weekly arena entry can be `$2.99` or `500 coins`.

Skins are not only cosmetic; they create player identity and status in rooms, leaderboards, and future tournaments.

## Engagement and Growth

ChaosMate is designed to grow through community and competition:

- Weekend Arena unlocks when the platform reaches 100 active players.
- Inviting a friend gives 1 free tournament entry.
- Weekly tournaments encourage players to improve their ELO.
- A separate big offline tournament on May 19, 2026 requires ChaosMate ELO 2000+.
- City leaderboards create local rivalry between Almaty, Astana, Shymkent, Karaganda, and other cities.

This turns the project from a simple chess app into a potential community-driven chess service.

## Tech Stack

Next.js 14, TypeScript, React, Supabase, Stockfish.js, chess.js, Tailwind CSS, Socket.io.

## Run Locally

```bash
npm install
npm run dev
```

Create `.env.local` for Supabase:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```
