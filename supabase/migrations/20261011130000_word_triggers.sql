-- Saving a word creates its two cards in the same transaction, and the database owns words.updated_at.

-- security definer: bypasses RLS on cards, which is safe because the word row has already
-- passed its own RLS check and the cards copy new.user_id.
create function public.create_cards_for_word()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.cards (user_id, word_id, direction, state, due)
  values
    (new.user_id, new.id, 'de_en', 'new', now()),
    (new.user_id, new.id, 'en_de', 'new', now() + interval '1 day');
  return new;
end;
$$;

revoke execute on function public.create_cards_for_word() from public, anon, authenticated;

create trigger words_create_cards
  after insert on public.words
  for each row execute function public.create_cards_for_word();

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger words_set_updated_at
  before update on public.words
  for each row execute function public.set_updated_at();
