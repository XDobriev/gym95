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
