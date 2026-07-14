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
