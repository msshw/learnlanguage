-- Local test users only: alice@test.local, bob@test.local and admin@test.local (an admin), password "password123".
-- Token columns are empty strings, not NULL: GoTrue fails to scan NULLs there.
-- Profiles are created by the on_auth_user_created trigger.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
) values
  (
    '00000000-0000-0000-0000-000000000000', 'a11ce000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'alice@test.local',
    crypt('password123', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(),
    '', '', '', '', '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000', 'b0b00000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'bob@test.local',
    crypt('password123', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(),
    '', '', '', '', '', '', '', ''
  );

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) values
  (
    gen_random_uuid(), 'a11ce000-0000-4000-8000-000000000001',
    'a11ce000-0000-4000-8000-000000000001',
    '{"sub":"a11ce000-0000-4000-8000-000000000001","email":"alice@test.local","email_verified":true}',
    'email', now(), now(), now()
  ),
  (
    gen_random_uuid(), 'b0b00000-0000-4000-8000-000000000002',
    'b0b00000-0000-4000-8000-000000000002',
    '{"sub":"b0b00000-0000-4000-8000-000000000002","email":"bob@test.local","email_verified":true}',
    'email', now(), now(), now()
  );

-- Admin for the suggestion admin page. Kept separate from alice and bob so tests can rely on them
-- being ordinary users. Seed runs as postgres, which the is_admin guard trigger allows.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
) values (
  '00000000-0000-0000-0000-000000000000', 'ad000000-0000-4000-8000-000000000003',
  'authenticated', 'authenticated', 'admin@test.local',
  crypt('password123', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(),
  '', '', '', '', '', '', '', ''
);

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) values (
  gen_random_uuid(), 'ad000000-0000-4000-8000-000000000003',
  'ad000000-0000-4000-8000-000000000003',
  '{"sub":"ad000000-0000-4000-8000-000000000003","email":"admin@test.local","email_verified":true}',
  'email', now(), now(), now()
);

update public.profiles set is_admin = true where id = 'ad000000-0000-4000-8000-000000000003';
