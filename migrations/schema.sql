-- gym95: схема хранения тренировок
create extension if not exists "pgcrypto"; -- для gen_random_uuid()

create table if not exists workouts (
  id uuid primary key default gen_random_uuid(),
  user_id bigint not null,
  date timestamptz not null default now(),
  type text not null check (type in ('cardio', 'strength', 'pool', 'mixed')),
  duration_minutes int null,
  notes text null
);

create index if not exists idx_workouts_user_date
  on workouts (user_id, date desc);

create table if not exists exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references workouts (id) on delete cascade,
  name text not null,
  sets jsonb not null default '[]'::jsonb, -- [{"weight":40,"reps":12}, ...]
  order_index int not null default 0
);

create index if not exists idx_exercises_workout
  on exercises (workout_id);

create index if not exists idx_exercises_name
  on exercises (name);

create index if not exists idx_exercises_name_workout
  on exercises (name, workout_id);

create table if not exists cardio_sessions (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references workouts (id) on delete cascade,
  activity text not null check (activity in ('treadmill', 'pool', 'bike')),
  distance_km numeric null,
  avg_heart_rate int null,
  avg_pace text null
);

create index if not exists idx_cardio_workout
  on cardio_sessions (workout_id);

-- Справочник упражнений: user_id null = общий дефолтный список, иначе — личное упражнение пользователя
create table if not exists exercise_catalog (
  id uuid primary key default gen_random_uuid(),
  user_id bigint null,
  name text not null,
  muscle_group text null check (muscle_group is null or muscle_group in ('chest','back','legs','shoulders','arms','abs')),
  created_at timestamptz not null default now()
);

create unique index if not exists idx_exercise_catalog_default_name
  on exercise_catalog (lower(name)) where user_id is null;

create unique index if not exists idx_exercise_catalog_user_name
  on exercise_catalog (user_id, lower(name)) where user_id is not null;

create index if not exists idx_exercise_catalog_group
  on exercise_catalog (muscle_group);

insert into exercise_catalog (name, muscle_group) values
  ('Жим штанги лёжа','chest'), ('Жим гантелей лёжа','chest'), ('Жим штанги на наклонной скамье','chest'),
  ('Разводка гантелей лёжа','chest'), ('Отжимания на брусьях','chest'), ('Кроссовер','chest'),
  ('Тяга верхнего блока','back'), ('Тяга штанги в наклоне','back'), ('Тяга гантели в наклоне','back'),
  ('Румынская тяга','back'), ('Становая тяга','back'), ('Гиперэкстензия','back'), ('Подтягивания','back'),
  ('Приседания со штангой','legs'), ('Жим ногами','legs'), ('Выпады с гантелями','legs'),
  ('Разгибание ног в тренажёре','legs'), ('Сгибание ног в тренажёре','legs'), ('Подъём на носки','legs'),
  ('Жим штанги стоя','shoulders'), ('Жим гантелей сидя','shoulders'), ('Махи гантелями в стороны','shoulders'),
  ('Махи гантелями в наклоне','shoulders'), ('Тяга штанги к подбородку','shoulders'),
  ('Подъём штанги на бицепс','arms'), ('Подъём гантелей на бицепс (молот)','arms'), ('Французский жим','arms'),
  ('Разгибание рук на блоке','arms'), ('Отжимания узким хватом','arms'),
  ('Скручивания','abs'), ('Подъём ног в висе','abs'), ('Планка','abs'), ('Скручивания на блоке','abs')
on conflict (lower(name)) where user_id is null do nothing;

-- Кардио: добавляем бег/ходьбу и уклон
alter table cardio_sessions drop constraint if exists cardio_sessions_activity_check;
alter table cardio_sessions add constraint cardio_sessions_activity_check
  check (activity in ('treadmill', 'pool', 'bike', 'running', 'walking'));
alter table cardio_sessions add column if not exists incline_percent numeric null;

-- Разминка/растяжка как часть тренировки
alter table workouts add column if not exists warmup_minutes int null;

-- Настройки напоминаний пользователя (1 строка на пользователя, upsert по user_id)
create table if not exists user_settings (
  user_id bigint primary key,
  reminders_enabled boolean not null default false,
  reminder_time text null check (reminder_time is null or reminder_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  last_reminder_sent_date date null
);

create index if not exists idx_user_settings_reminder_time
  on user_settings (reminder_time) where reminders_enabled = true;

-- Персональная недельная цель по числу тренировок (1-7), дефолт 3
alter table user_settings add column if not exists week_goal int not null default 3
  check (week_goal between 1 and 7);

-- ===== Этап 1: многопользовательский фундамент (2026-10-20) =====

create table if not exists profiles (
  user_id      bigint primary key,
  goal         text not null check (goal in ('lose', 'gain', 'regular')),
  sex          text not null check (sex in ('male', 'female')),
  birth_year   int  not null check (birth_year between 1930 and 2020),
  height_cm    int  not null check (height_cm between 120 and 230),
  timezone     text not null default 'Europe/Moscow',
  invited_by   bigint null,
  onboarded_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

create table if not exists user_modules (
  user_id  bigint not null,
  module   text   not null check (module in ('weight', 'activity', 'water', 'food', 'sleep')),
  enabled  boolean not null default false,
  settings jsonb  not null default '{}'::jsonb,
  primary key (user_id, module)
);

create table if not exists invites (
  code       text primary key,
  created_by bigint not null,
  uses_left  int not null default 1 check (uses_left >= 0),
  created_at timestamptz not null default now()
);

create table if not exists body_weights (
  id          uuid primary key default gen_random_uuid(),
  user_id     bigint not null,
  weight_kg   numeric(5,1) not null check (weight_kg between 35 and 300),
  measured_at timestamptz not null default now()
);

create index if not exists idx_body_weights_user_time on body_weights (user_id, measured_at desc);

-- Бот ходит в базу service_role-ключом (RLS его не касается). RLS без политик
-- закрывает новые таблицы от anon-ключа через PostgREST.
alter table profiles enable row level security;
alter table user_modules enable row level security;
alter table invites enable row level security;
alter table body_weights enable row level security;

-- Атомарно: списать приглашение (если передано), создать профиль, записать первый вес.
-- p_invite_code = null — для владельца бота. Ошибка 'invite_invalid', если код не найден или исчерпан.
create or replace function redeem_invite_and_create_profile(
  p_user_id bigint,
  p_invite_code text,
  p_goal text,
  p_sex text,
  p_birth_year int,
  p_height_cm int,
  p_timezone text,
  p_weight_kg numeric
) returns void
language plpgsql
as $$
declare
  v_inviter bigint := null;
begin
  if p_invite_code is not null then
    update invites set uses_left = uses_left - 1
      where code = p_invite_code and uses_left > 0
      returning created_by into v_inviter;
    if not found then
      raise exception 'invite_invalid';
    end if;
  end if;

  insert into profiles (user_id, goal, sex, birth_year, height_cm, timezone, invited_by)
    values (p_user_id, p_goal, p_sex, p_birth_year, p_height_cm, p_timezone, v_inviter);

  insert into body_weights (user_id, weight_kg) values (p_user_id, p_weight_kg);
end;
$$;

revoke execute on function redeem_invite_and_create_profile(bigint, text, text, text, int, int, text, numeric)
  from public, anon, authenticated;
