-- Six tables from SPEC section 4. RLS is in the next migration.

create table public.language_pairs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  target_lang text not null,
  native_lang text not null,
  created_at timestamptz not null default now(),
  unique (user_id, target_lang, native_lang)
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  active_pair_id uuid references public.language_pairs (id) on delete set null,
  new_words_per_day int not null default 10 check (new_words_per_day >= 0),
  timezone text not null default 'Europe/Berlin',
  created_at timestamptz not null default now()
);

create table public.words (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  pair_id uuid not null references public.language_pairs (id) on delete cascade,
  term text not null check (length(btrim(term)) > 0),
  part_of_speech text not null
    check (part_of_speech in ('noun', 'verb', 'adjective', 'adverb', 'phrase', 'other')),
  translations text[] not null check (cardinality(translations) >= 1),
  hint_en text,
  forms jsonb not null default '{}'::jsonb,
  example_de text,
  example_en text,
  notes text,
  tags text[] not null default '{}',
  source text not null default 'manual' check (source in ('manual', 'ai_confirmed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index words_tags_idx on public.words using gin (tags);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  word_id uuid not null references public.words (id) on delete cascade,
  direction text not null check (direction in ('de_en', 'en_de')),
  state text not null default 'new'
    check (state in ('new', 'learning', 'review', 'relearning')),
  due timestamptz not null default now(),
  stability double precision not null default 0,
  difficulty double precision not null default 0,
  elapsed_days int not null default 0,
  scheduled_days int not null default 0,
  reps int not null default 0,
  lapses int not null default 0,
  last_review timestamptz,
  unique (word_id, direction)
);

create index cards_user_due_idx on public.cards (user_id, due);

create table public.review_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid not null references public.cards (id) on delete cascade,
  reviewed_at timestamptz not null default now(),
  typed_answer text not null,
  grader_result text not null
    check (grader_result in ('correct', 'typo', 'article_wrong', 'wrong')),
  rating smallint not null check (rating between 1 and 4),
  overridden boolean not null default false,
  state_before jsonb not null,
  duration_ms int
);

create table public.ai_calls (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null default 'autofill',
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  latency_ms int not null default 0,
  ok boolean not null,
  error text,
  created_at timestamptz not null default now()
);
