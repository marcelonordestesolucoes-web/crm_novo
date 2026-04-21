-- Stitch CRM schema/data validation queries.
-- Run after:
-- 1) supabase/migrations/202604210001_baseline_current_app.sql
-- 2) supabase/migrations/202604210002_backfill_existing_data.sql
--
-- Expected result:
-- - every row in section 1 should have issue_count = 0;
-- - every row in section 2 should have orphan_count = 0;
-- - every row in section 3 should have duplicate_groups = 0;
-- - every row in section 4 should have issue_count = 0.
--
-- These queries are read-only.

-- ---------------------------------------------------------------------------
-- 1. Tenant scope: records without org_id.
-- ---------------------------------------------------------------------------

select 'companies_without_org_id' as check_name, count(*) as issue_count
from public.companies
where org_id is null
union all
select 'contacts_without_org_id', count(*)
from public.contacts
where org_id is null
union all
select 'pipelines_without_org_id', count(*)
from public.pipelines
where org_id is null
union all
select 'deals_without_org_id', count(*)
from public.deals
where org_id is null
union all
select 'tasks_without_org_id', count(*)
from public.tasks
where org_id is null
union all
select 'deal_conversations_without_org_id', count(*)
from public.deal_conversations
where org_id is null
union all
select 'conversations_without_org_id', count(*)
from public.conversations
where org_id is null
union all
select 'messages_without_org_id', count(*)
from public.messages
where org_id is null
union all
select 'campaigns_without_org_id', count(*)
from public.campaigns
where org_id is null
union all
select 'org_goals_without_org_id', count(*)
from public.org_goals
where org_id is null
union all
select 'member_goals_without_org_id', count(*)
from public.member_goals
where org_id is null
union all
select 'user_events_without_org_id', count(*)
from public.user_events
where org_id is null
union all
select 'ai_feedback_without_org_id', count(*)
from public.ai_feedback
where org_id is null
union all
select 'ai_usage_history_without_org_id', count(*)
from public.ai_usage_history
where org_id is null;

-- Samples for tenant-scope failures.
select 'deals_without_org_id' as sample_name, id, title, created_at
from public.deals
where org_id is null
order by created_at desc
limit 25;

select 'deal_conversations_without_org_id' as sample_name, id, deal_id, chat_id, sender_phone, created_at
from public.deal_conversations
where org_id is null
order by created_at desc
limit 25;

-- ---------------------------------------------------------------------------
-- 2. Broken references / orphaned data.
-- ---------------------------------------------------------------------------

select 'memberships_missing_org' as check_name, count(*) as orphan_count
from public.memberships m
left join public.organizations o on o.id = m.org_id
where o.id is null
union all
select 'companies_missing_org', count(*)
from public.companies c
left join public.organizations o on o.id = c.org_id
where c.org_id is not null and o.id is null
union all
select 'contacts_missing_org', count(*)
from public.contacts c
left join public.organizations o on o.id = c.org_id
where c.org_id is not null and o.id is null
union all
select 'contacts_missing_company', count(*)
from public.contacts c
left join public.companies co on co.id = c.company_id
where c.company_id is not null and co.id is null
union all
select 'pipelines_missing_org', count(*)
from public.pipelines p
left join public.organizations o on o.id = p.org_id
where p.org_id is not null and o.id is null
union all
select 'pipeline_stages_missing_pipeline', count(*)
from public.pipeline_stages ps
left join public.pipelines p on p.id = ps.pipeline_id
where p.id is null
union all
select 'deals_missing_org', count(*)
from public.deals d
left join public.organizations o on o.id = d.org_id
where d.org_id is not null and o.id is null
union all
select 'deals_missing_company', count(*)
from public.deals d
left join public.companies c on c.id = d.company_id
where d.company_id is not null and c.id is null
union all
select 'deals_missing_pipeline', count(*)
from public.deals d
left join public.pipelines p on p.id = d.pipeline_id
where d.pipeline_id is not null and p.id is null
union all
select 'deal_contacts_missing_deal', count(*)
from public.deal_contacts dc
left join public.deals d on d.id = dc.deal_id
where d.id is null
union all
select 'deal_contacts_missing_contact', count(*)
from public.deal_contacts dc
left join public.contacts c on c.id = dc.contact_id
where c.id is null
union all
select 'tasks_missing_deal', count(*)
from public.tasks t
left join public.deals d on d.id = t.deal_id
where t.deal_id is not null and d.id is null
union all
select 'deal_notes_missing_deal', count(*)
from public.deal_notes n
left join public.deals d on d.id = n.deal_id
where d.id is null
union all
select 'deal_attachments_missing_deal', count(*)
from public.deal_attachments a
left join public.deals d on d.id = a.deal_id
where d.id is null
union all
select 'deal_timeline_missing_deal', count(*)
from public.deal_timeline t
left join public.deals d on d.id = t.deal_id
where t.deal_id is not null and d.id is null
union all
select 'deal_conversations_missing_deal', count(*)
from public.deal_conversations dc
left join public.deals d on d.id = dc.deal_id
where dc.deal_id is not null and d.id is null
union all
select 'deal_conversations_missing_contact', count(*)
from public.deal_conversations dc
left join public.contacts c on c.id = dc.contact_id
where dc.contact_id is not null and c.id is null
union all
select 'campaign_leads_missing_campaign', count(*)
from public.campaign_leads cl
left join public.campaigns c on c.id = cl.campaign_id
where c.id is null
union all
select 'campaign_leads_missing_contact', count(*)
from public.campaign_leads cl
left join public.contacts c on c.id = cl.contact_id
where cl.contact_id is not null and c.id is null
union all
select 'messages_missing_conversation', count(*)
from public.messages m
left join public.conversations c on c.id = m.conversation_id
where m.conversation_id is not null and c.id is null;

-- Samples for orphaned high-impact rows.
select 'orphan_deal_contacts' as sample_name, dc.*
from public.deal_contacts dc
left join public.deals d on d.id = dc.deal_id
left join public.contacts c on c.id = dc.contact_id
where d.id is null or c.id is null
limit 25;

select 'orphan_deal_conversations' as sample_name, dc.id, dc.org_id, dc.deal_id, dc.contact_id, dc.chat_id, dc.sender_phone
from public.deal_conversations dc
left join public.deals d on d.id = dc.deal_id
left join public.contacts c on c.id = dc.contact_id
where (dc.deal_id is not null and d.id is null)
   or (dc.contact_id is not null and c.id is null)
limit 25;

-- ---------------------------------------------------------------------------
-- 3. Duplicate messages/conversations.
-- ---------------------------------------------------------------------------

-- Active inbox duplicates by external provider message id.
select
  'deal_conversations_duplicate_external_message_id' as check_name,
  count(*) as duplicate_groups
from (
  select org_id, external_message_id
  from public.deal_conversations
  where external_message_id is not null
  group by org_id, external_message_id
  having count(*) > 1
) dupes
union all
-- Active inbox duplicates by same chat/content/timestamp.
select
  'deal_conversations_duplicate_chat_content_time',
  count(*)
from (
  select org_id, chat_id, content, created_at
  from public.deal_conversations
  where chat_id is not null
  group by org_id, chat_id, content, created_at
  having count(*) > 1
) dupes
union all
-- Legacy worker duplicate provider ids.
select
  'messages_duplicate_wa_id',
  count(*)
from (
  select source, wa_id
  from public.messages
  where wa_id is not null
  group by source, wa_id
  having count(*) > 1
) dupes
union all
-- Active conversations should have one active row per org/phone/source.
select
  'conversations_duplicate_active_phone_source',
  count(*)
from (
  select org_id, phone, source
  from public.conversations
  where status = 'active'
  group by org_id, phone, source
  having count(*) > 1
) dupes
union all
-- CRM relation duplicate guard.
select
  'deal_contacts_duplicate_links',
  count(*)
from (
  select deal_id, contact_id
  from public.deal_contacts
  group by deal_id, contact_id
  having count(*) > 1
) dupes
union all
-- Contact identity duplicates by tenant/phone.
select
  'contacts_duplicate_org_phone',
  count(*)
from (
  select org_id, phone
  from public.contacts
  where org_id is not null and phone is not null
  group by org_id, phone
  having count(*) > 1
) dupes
union all
-- Dynamic pipeline stages should not have repeated labels in the same pipeline.
select
  'pipeline_duplicate_stage_labels',
  count(*)
from (
  select pipeline_id, lower(label)
  from public.pipeline_stages
  group by pipeline_id, lower(label)
  having count(*) > 1
) dupes;

-- Samples of duplicate active inbox rows.
select
  org_id,
  external_message_id,
  count(*) as row_count,
  array_agg(id order by created_at) as ids
from public.deal_conversations
where external_message_id is not null
group by org_id, external_message_id
having count(*) > 1
order by row_count desc
limit 25;

select
  org_id,
  chat_id,
  content,
  created_at,
  count(*) as row_count,
  array_agg(id order by id) as ids
from public.deal_conversations
where chat_id is not null
group by org_id, chat_id, content, created_at
having count(*) > 1
order by row_count desc
limit 25;

-- ---------------------------------------------------------------------------
-- 4. Cross-tenant relationship consistency.
-- ---------------------------------------------------------------------------

select 'deals_org_id_organization_id_mismatch' as check_name, count(*) as issue_count
from public.deals
where org_id is not null
  and organization_id is not null
  and org_id is distinct from organization_id
union all
select 'deals_company_org_mismatch', count(*)
from public.deals d
join public.companies c on c.id = d.company_id
where d.org_id is distinct from c.org_id
union all
select 'contacts_company_org_mismatch', count(*)
from public.contacts c
join public.companies co on co.id = c.company_id
where c.org_id is distinct from co.org_id
union all
select 'deal_contacts_org_mismatch', count(*)
from public.deal_contacts dc
join public.deals d on d.id = dc.deal_id
join public.contacts c on c.id = dc.contact_id
where d.org_id is distinct from c.org_id
union all
select 'deal_conversations_deal_org_mismatch', count(*)
from public.deal_conversations dc
join public.deals d on d.id = dc.deal_id
where dc.org_id is distinct from d.org_id
union all
select 'deal_conversations_contact_org_mismatch', count(*)
from public.deal_conversations dc
join public.contacts c on c.id = dc.contact_id
where dc.org_id is distinct from c.org_id
union all
select 'tasks_deal_org_mismatch', count(*)
from public.tasks t
join public.deals d on d.id = t.deal_id
where t.org_id is distinct from d.org_id
union all
select 'pipelines_stage_org_mismatch', count(*)
from public.pipeline_stages ps
join public.pipelines p on p.id = ps.pipeline_id
where p.org_id is null
union all
select 'campaign_leads_contact_org_mismatch', count(*)
from public.campaign_leads cl
join public.campaigns ca on ca.id = cl.campaign_id
join public.contacts c on c.id = cl.contact_id
where ca.org_id is distinct from c.org_id
union all
select 'messages_conversation_org_mismatch', count(*)
from public.messages m
join public.conversations c on c.id = m.conversation_id
where m.org_id is distinct from c.org_id
union all
select 'messages_deal_org_mismatch', count(*)
from public.messages m
join public.deals d on d.id = m.deal_id
where m.org_id is distinct from d.org_id
union all
select 'messages_contact_org_mismatch', count(*)
from public.messages m
join public.contacts c on c.id = m.contact_id
where m.org_id is distinct from c.org_id
union all
select 'user_events_deal_org_mismatch', count(*)
from public.user_events e
join public.deals d on d.id = e.deal_id
where e.org_id is distinct from d.org_id
union all
select 'ai_feedback_deal_org_mismatch', count(*)
from public.ai_feedback f
join public.deals d on d.id = f.deal_id
where f.org_id is distinct from d.org_id;

-- Samples of cross-tenant issues.
select
  'deal_contacts_org_mismatch' as sample_name,
  dc.deal_id,
  d.org_id as deal_org_id,
  dc.contact_id,
  c.org_id as contact_org_id
from public.deal_contacts dc
join public.deals d on d.id = dc.deal_id
join public.contacts c on c.id = dc.contact_id
where d.org_id is distinct from c.org_id
limit 25;

select
  'deal_conversations_org_mismatch' as sample_name,
  dc.id,
  dc.org_id as conversation_org_id,
  dc.deal_id,
  d.org_id as deal_org_id,
  dc.contact_id,
  c.org_id as contact_org_id
from public.deal_conversations dc
left join public.deals d on d.id = dc.deal_id
left join public.contacts c on c.id = dc.contact_id
where (dc.deal_id is not null and dc.org_id is distinct from d.org_id)
   or (dc.contact_id is not null and dc.org_id is distinct from c.org_id)
limit 25;

-- ---------------------------------------------------------------------------
-- 5. App-specific consistency checks.
-- ---------------------------------------------------------------------------

select 'deals_without_pipeline' as check_name, count(*) as issue_count
from public.deals
where pipeline_id is null
union all
select 'pipelines_without_stages', count(*)
from public.pipelines p
where not exists (
  select 1 from public.pipeline_stages ps where ps.pipeline_id = p.id
)
union all
select 'deals_stage_not_in_pipeline_stages', count(*)
from public.deals d
where d.pipeline_id is not null
  and not exists (
    select 1
    from public.pipeline_stages ps
    where ps.pipeline_id = d.pipeline_id
      and ps.id::text = d.stage
  )
union all
select 'deal_conversations_without_chat_id', count(*)
from public.deal_conversations
where chat_id is null or length(trim(chat_id)) = 0
union all
select 'whatsapp_contacts_without_phone', count(*)
from public.contacts
where is_auto_created = true
  and (phone is null or length(trim(phone)) = 0)
union all
select 'memberships_without_profile', count(*)
from public.memberships m
left join public.profiles p on p.id = m.user_id
where p.id is null;

-- Samples for app-specific consistency failures.
select 'deals_stage_not_in_pipeline_stages' as sample_name, d.id, d.title, d.pipeline_id, d.stage
from public.deals d
where d.pipeline_id is not null
  and not exists (
    select 1
    from public.pipeline_stages ps
    where ps.pipeline_id = d.pipeline_id
      and ps.id::text = d.stage
  )
limit 25;

select 'deal_conversations_without_chat_id' as sample_name, id, org_id, deal_id, contact_id, sender_phone
from public.deal_conversations
where chat_id is null or length(trim(chat_id)) = 0
limit 25;
