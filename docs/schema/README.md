# Schema Notes

This directory tracks database design notes, ERDs, and migration rationale.

## Implemented migration set

- `20260331190000_enable_extensions_and_helpers.sql`
  - enables `pgcrypto`
  - creates shared helper functions for `updated_at` triggers and RLS ownership checks
- `20260331191000_create_core_schema.sql`
  - creates the user-owned product tables plus sync/import audit tables
  - adds trigger-based `updated_at` maintenance
- `20260331192000_create_indexes.sql`
  - adds trend, weekly aggregation, dedupe, and search indexes
- `20260331193000_enable_rls_and_policies.sql`
  - enables row-level security
  - grants authenticated-role access only where intended
  - applies per-user ownership policies

## Local apply and seed flow

```bash
supabase start
supabase db reset
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/seed/001_local_dev_seed.sql
```

## RLS shape

- Manual-entry tables allow authenticated users to `select`, `insert`, and `update` only their own rows.
- Operational sync/import tables allow authenticated users to `select` only their own rows.
- Provider-facing writes are expected to come from trusted backend/server-role paths, but every row still carries `user_id` and remains query-scoped per user.

## Seed data scope

The local seed includes:

- one authenticated development user and profile
- three cardio templates aligned to Tuesday/Thursday/Saturday usage
- body-metric trend rows
- recovery check-ins
- cardio sessions
- one weekly review
- two journal entries
