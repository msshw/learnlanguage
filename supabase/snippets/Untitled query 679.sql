update public.cards
set state='review', due=now() - interval '1 day', stability=5, difficulty=5,
    reps=2, scheduled_days=5, elapsed_days=5, last_review=now() - interval '6 days'
where direction='de_en' and state='new';