# Supabase Migration Structure

This folder is the canonical migration source for the current app.

## Current baseline

`202604210001_baseline_current_app.sql`

Creates the schema expected by the existing React frontend and Edge Functions.
It keeps compatibility with the current code by retaining both messaging models:

- `deal_conversations`: active inbox/chat model used by the UI.
- `conversations` + `messages`: legacy/worker model used by `ai-interpret-message`.

Do not delete the older loose SQL files yet. Treat them as historical patches.
New database changes should land here as numbered migrations.

## Recommended sequence

1. `202604210001_baseline_current_app.sql`
   Baseline tables, indexes, storage buckets, RLS, and app RPCs.

2. `202604210002_backfill_existing_data.sql`
   Optional data repair for existing environments:
   - set missing `org_id` from related deals/memberships;
   - normalize `deal_conversations.chat_id`;
   - backfill `contacts.org_id`;
   - create default pipeline/stages per org when missing.

3. `202604210003_harden_whatsapp_idempotency.sql`
   Optional production hardening:
   - convert webhook insert to upsert;
   - enforce unique `(org_id, external_message_id)` for WhatsApp messages;
   - add dead-letter/error table for webhook failures.

4. `202604210004_unify_message_model.sql`
   Future refactor only after code changes:
   - migrate `messages`/`conversations` into `deal_conversations` or vice versa;
   - update `ai-interpret-message`;
   - remove the deprecated model after one release cycle.

5. `202604210005_campaign_worker.sql`
   Move campaign execution out of the browser:
   - queue table or scheduled worker state;
   - row locks for one-lead-at-a-time processing;
   - audit table for Z-API sends.

## Rules

- Migrations must be append-only and timestamp-prefixed.
- Avoid editing an already-applied migration; create a new one.
- Schema changes must be compatible with RLS.
- Frontend-visible table/column changes should be accompanied by service changes.
- Destructive changes need a backfill migration and a rollback note.
