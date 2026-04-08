# Supabase Workspace

- `migrations/`: ordered SQL migrations for schema, indexes, and RLS
- `policies/`: optional reference notes if policy SQL is ever split from migrations
- `seed/`: deterministic local development seed scripts

## Local workflow

Apply migrations against the local Supabase stack:

```bash
supabase start
supabase db reset
```

Load the local development seed set:

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/seed/001_local_dev_seed.sql
```

## Seeded local user

- Email: `dev@example.com`
- Password: `password1234`

The seeded profile and sample rows are intentionally small and geared toward manual testing of body metrics, recovery, cardio logging, weekly review rendering, and journal surfaces.
