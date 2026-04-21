# Schema Consolidation Notes

## Active application model

The current frontend is centered on these tables:

- Tenant/auth: `organizations`, `profiles`, `memberships`, `invitations`
- CRM: `companies`, `contacts`, `pipelines`, `pipeline_stages`, `deals`, `deal_contacts`
- Activity: `tasks`, `deal_notes`, `deal_attachments`, `deal_timeline`
- WhatsApp inbox: `deal_conversations`
- Campaigns: `campaigns`, `campaign_leads`
- Goals: `org_goals`, `member_goals`
- AI/analytics: `user_events`, `ai_feedback`, `ai_usage_history`, `ai_strategy_performance`

The consolidated baseline is:

`supabase/migrations/202604210001_baseline_current_app.sql`

## Duplicated or inconsistent models

### `deal_conversations` vs `conversations` / `messages`

`deal_conversations` is the active model used by:

- `src/services/whatsapp.js`
- `src/services/conversations.js`
- `src/views/Messages/WhatsAppInbox.jsx`
- `supabase/functions/analyze-conversation`
- dashboard onboarding logic

`conversations` and `messages` came from `whatsapp_ingestion_v4.sql` and are still used by:

- `supabase/functions/ai-interpret-message`
- old queue/rate-limit SQLs
- scratch/test scripts

Decision: keep both for now. Treat `messages`/`conversations` as legacy worker tables until the Edge Function is migrated to `deal_conversations`.

### `org_id` vs `organization_id`

Most current code uses `org_id`. Some comments and older SQLs mention `organization_id`.

Decision: `org_id` is canonical. `organization_id` remains on `deals` only as compatibility baggage.

### Company/contact naming drift

Older schema used:

- `companies.tax_id`, `companies.sector`
- `contacts.company`, `contacts.avatar`

Current services also expect:

- `companies.cnpj`, `companies.segment`, `companies.user_id`
- `contacts.org_id`, `contacts.company_id`, `contacts.avatar_url`, `contacts.is_auto_created`

Decision: keep both old and new columns where the UI still reads fallbacks.

### AI SQL sprawl

The old SQLs split AI fields across:

- `ai_usage_migration_elite.sql`
- `ai_atomic_ops.sql`
- `ai_usage_history.sql`
- `phase5_*`
- `oracle_v*`
- `global_scale_migration.sql`

Decision: the baseline includes the app-facing subset: usage counters, rate-limit RPCs, validation metrics, onboarding progress, user events, feedback, and strategy performance.

## Migration strategy

Use timestamped migrations in `supabase/migrations`.

Recommended next files:

- `202604210002_backfill_existing_data.sql`
- `202604210003_harden_whatsapp_idempotency.sql`
- `202604210004_unify_message_model.sql`
- `202604210005_campaign_worker.sql`

The loose SQL files in `supabase/*.sql` should be kept as historical references until every environment has applied the new baseline/backfill path.
