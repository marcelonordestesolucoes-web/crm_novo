-- Stitch CRM existing data backfill.
-- Requirements:
-- - migrate old data into the consolidated schema created by 202604210001;
-- - keep org_id and organization_id consistent;
-- - preserve relationships between deals, contacts, conversations and legacy messages;
-- - avoid duplicate links/rows;
-- - remain idempotent.
--
-- Safe to run more than once. Every update is scoped to null/missing data or uses
-- ON CONFLICT / NOT EXISTS guards.

begin;

-- ---------------------------------------------------------------------------
-- 1. Ensure there is at least one organization for orphan legacy data.
--
-- Old local/dev schemas sometimes had CRM data without organizations. This
-- fallback is only usable when the database is mono-tenant. In multi-tenant
-- databases, ambiguous rows abort the migration instead of being assigned.
-- ---------------------------------------------------------------------------

insert into public.organizations (name, plan_name)
select 'Default Organization', 'migration'
where not exists (select 1 from public.organizations);

create temp table _backfill_context as
select
  count(*) as org_count,
  min(id) as single_org_id
from public.organizations;

-- ---------------------------------------------------------------------------
-- 2. Create missing profiles for users that already own data or memberships.
--
-- This preserves joins such as profiles!responsible_id and profiles!user_id.
-- ---------------------------------------------------------------------------

insert into public.profiles (id, full_name, created_at, updated_at)
select distinct u.user_id, 'Usuário', now(), now()
from (
  select user_id from public.memberships where user_id is not null
  union
  select user_id from public.companies where user_id is not null
  union
  select responsible_id from public.companies where responsible_id is not null
  union
  select user_id from public.contacts where user_id is not null
  union
  select responsible_id from public.deals where responsible_id is not null
  union
  select owner_id from public.deals where owner_id is not null
  union
  select user_id from public.tasks where user_id is not null
  union
  select user_id from public.deal_notes where user_id is not null
  union
  select user_id from public.deal_attachments where user_id is not null
) u
join auth.users au on au.id = u.user_id
where u.user_id is not null
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Create memberships for users that own legacy data but have no membership.
--
-- Memberships are created only when org_id can be inferred from the owning row
-- or when the database is explicitly mono-tenant. Inferred users are members,
-- never admins.
-- ---------------------------------------------------------------------------

insert into public.memberships (user_id, org_id, role)
select distinct owned.user_id, owned.org_id, 'member'
from (
  select c.user_id, coalesce(c.org_id, (select single_org_id from _backfill_context where org_count = 1)) as org_id
  from public.companies c
  where c.user_id is not null
  union
  select c.responsible_id, coalesce(c.org_id, (select single_org_id from _backfill_context where org_count = 1))
  from public.companies c
  where c.responsible_id is not null
  union
  select c.user_id, coalesce(c.org_id, (select single_org_id from _backfill_context where org_count = 1))
  from public.contacts c
  where c.user_id is not null
  union
  select d.responsible_id, coalesce(d.org_id, d.organization_id, (select single_org_id from _backfill_context where org_count = 1))
  from public.deals d
  where d.responsible_id is not null
  union
  select d.owner_id, coalesce(d.org_id, d.organization_id, (select single_org_id from _backfill_context where org_count = 1))
  from public.deals d
  where d.owner_id is not null
  union
  select t.user_id, coalesce(t.org_id, d.org_id, d.organization_id, (select single_org_id from _backfill_context where org_count = 1))
  from public.tasks t
  left join public.deals d on d.id = t.deal_id
  where t.user_id is not null
) owned
join auth.users au on au.id = owned.user_id
join public.organizations o on o.id = owned.org_id
where owned.user_id is not null
  and owned.org_id is not null
on conflict (user_id, org_id) do nothing;

-- ---------------------------------------------------------------------------
-- 4. Normalize organization columns.
--
-- org_id is canonical. organization_id on deals is kept only for compatibility.
-- ---------------------------------------------------------------------------

update public.deals
set org_id = organization_id
where org_id is null
  and organization_id is not null;

update public.deals
set organization_id = org_id
where organization_id is null
  and org_id is not null;

update public.deals d
set org_id = c.org_id
from public.companies c
where d.org_id is null
  and d.company_id = c.id
  and c.org_id is not null;

do $$
begin
  if (select org_count from _backfill_context) > 1 and exists (
    select 1 from public.deals where org_id is null
    union all
    select 1 from public.companies where org_id is null
    union all
    select 1 from public.contacts where org_id is null
  ) then
    raise exception 'Backfill aborted: ambiguous tenant data remains in deals/companies/contacts. Provide explicit org_id mapping before running.';
  end if;
end $$;

update public.deals
set org_id = (select single_org_id from _backfill_context where org_count = 1)
where org_id is null;

update public.deals
set organization_id = org_id
where organization_id is null
  and org_id is not null;

update public.companies c
set org_id = d.org_id
from public.deals d
where c.org_id is null
  and d.company_id = c.id
  and d.org_id is not null;

update public.contacts c
set org_id = coalesce(co.org_id, d.org_id)
from public.companies co
left join public.deals d on d.company_id = co.id
where c.org_id is null
  and c.company_id = co.id
  and co.org_id is not null;

update public.contacts c
set org_id = d.org_id
from public.deal_contacts dc
join public.deals d on d.id = dc.deal_id
where c.org_id is null
  and c.id = dc.contact_id
  and d.org_id is not null;

update public.companies
set org_id = (select single_org_id from _backfill_context where org_count = 1)
where org_id is null;

update public.contacts
set org_id = (select single_org_id from _backfill_context where org_count = 1)
where org_id is null;

-- ---------------------------------------------------------------------------
-- 5. Normalize company/contact legacy fields.
--
-- Keeps old and new column names in sync without overwriting existing values.
-- ---------------------------------------------------------------------------

update public.companies
set cnpj = tax_id
where cnpj is null
  and tax_id is not null;

update public.companies
set tax_id = cnpj
where tax_id is null
  and cnpj is not null;

update public.companies
set segment = sector
where segment is null
  and sector is not null;

update public.companies
set sector = segment
where sector is null
  and segment is not null;

update public.contacts
set avatar_url = avatar
where avatar_url is null
  and avatar is not null;

update public.contacts
set avatar = avatar_url
where avatar is null
  and avatar_url is not null;

update public.contacts c
set company = co.name
from public.companies co
where c.company is null
  and c.company_id = co.id;

-- ---------------------------------------------------------------------------
-- 6. Ensure a default pipeline and stages per organization.
--
-- The frontend expects pipelines and dynamic stages. This creates one default
-- pipeline only for orgs that do not have any pipeline yet.
-- ---------------------------------------------------------------------------

insert into public.pipelines (org_id, name)
select o.id, 'Pipeline Principal'
from public.organizations o
where not exists (
  select 1 from public.pipelines p where p.org_id = o.id
);

with default_stages(label, color, sort_order) as (
  values
    ('Lead', 'bg-slate-500', 10),
    ('Qualificado', 'bg-blue-500', 20),
    ('Proposta', 'bg-amber-500', 30),
    ('Negociação', 'bg-violet-500', 40),
    ('Perdido', 'bg-red-500', 50),
    ('Ganho', 'bg-emerald-500', 60)
)
insert into public.pipeline_stages (pipeline_id, label, color, sort_order)
select p.id, ds.label, ds.color, ds.sort_order
from public.pipelines p
cross join default_stages ds
where not exists (
  select 1
  from public.pipeline_stages ps
  where ps.pipeline_id = p.id
    and lower(ps.label) = lower(ds.label)
);

update public.deals d
set pipeline_id = p.id
from public.pipelines p
where d.pipeline_id is null
  and p.org_id = d.org_id
  and p.id = (
    select p2.id
    from public.pipelines p2
    where p2.org_id = d.org_id
    order by p2.created_at asc
    limit 1
  );

-- Map legacy stage slugs to the dynamic stage IDs used by the current UI.
-- Without this, old deals with stage='lead' would not appear in UUID-based
-- pipeline columns.
with stage_aliases(old_stage, target_label) as (
  values
    ('lead', 'Lead'),
    ('discovery', 'Lead'),
    ('qualified', 'Qualificado'),
    ('proposal', 'Proposta'),
    ('negotiation', 'Negociação'),
    ('lost', 'Perdido'),
    ('closed_lost', 'Perdido'),
    ('won', 'Ganho'),
    ('closed_won', 'Ganho')
)
update public.deals d
set stage = ps.id::text
from stage_aliases sa
join public.pipeline_stages ps on lower(ps.label) = lower(sa.target_label)
join public.pipelines p on p.id = ps.pipeline_id
where d.pipeline_id = p.id
  and lower(d.stage) = sa.old_stage;

-- ---------------------------------------------------------------------------
-- 7. Backfill deal/contact links.
--
-- Links may be missing when deals have company_id and contacts have company_id.
-- The unique constraint on (deal_id, contact_id) prevents duplicates.
-- ---------------------------------------------------------------------------

insert into public.deal_contacts (deal_id, contact_id)
select d.id, c.id
from public.deals d
join public.contacts c
  on c.company_id = d.company_id
 and c.org_id = d.org_id
where d.company_id is not null
  and not exists (
    select 1
    from public.deal_contacts existing
    where existing.deal_id = d.id
  )
on conflict (deal_id, contact_id) do nothing;

-- ---------------------------------------------------------------------------
-- 8. Backfill org/contact/chat identity for active deal_conversations.
--
-- chat_id is the canonical inbox key. sender_phone is retained for search and
-- old links. The update is conservative: it fills only missing values.
-- ---------------------------------------------------------------------------

update public.deal_conversations dc
set org_id = d.org_id
from public.deals d
where dc.org_id is null
  and dc.deal_id = d.id
  and d.org_id is not null;

update public.deal_conversations dc
set org_id = c.org_id
from public.contacts c
where dc.org_id is null
  and dc.contact_id = c.id
  and c.org_id is not null;

do $$
begin
  if (select org_count from _backfill_context) > 1 and exists (
    select 1 from public.deal_conversations where org_id is null
  ) then
    raise exception 'Backfill aborted: ambiguous tenant data remains in deal_conversations. Provide explicit org_id mapping before running.';
  end if;
end $$;

update public.deal_conversations
set org_id = (select single_org_id from _backfill_context where org_count = 1)
where org_id is null;

update public.deal_conversations dc
set contact_id = c.id
from public.contacts c
where dc.contact_id is null
  and dc.org_id = c.org_id
  and dc.sender_phone is not null
  and c.phone = dc.sender_phone;

update public.deal_conversations dc
set sender_phone = c.phone
from public.contacts c
where dc.sender_phone is null
  and dc.contact_id = c.id
  and c.phone is not null;

update public.deal_conversations
set chat_id = case
  when sender_phone is not null and position('@' in sender_phone) > 0 then sender_phone
  when sender_phone is not null then regexp_replace(sender_phone, '\D', '', 'g') || '@c.us'
  when contact_id is not null then contact_id::text
  when deal_id is not null then deal_id::text
  else id::text
end
where chat_id is null
   or length(trim(chat_id)) = 0;

-- If old WhatsApp rows have no contact but have a phone/chat anchor, create a
-- lightweight contact once per org/phone. The NOT EXISTS guard prevents dupes.
insert into public.contacts (org_id, name, phone, is_auto_created)
select distinct on (dc.org_id, dc.sender_phone)
  dc.org_id,
  coalesce(nullif(dc.sender_name, ''), 'Lead WhatsApp'),
  dc.sender_phone,
  true
from public.deal_conversations dc
where dc.sender_phone is not null
  and dc.org_id is not null
  and not exists (
    select 1
    from public.contacts c
    where c.org_id = dc.org_id
      and c.phone = dc.sender_phone
  )
order by dc.org_id, dc.sender_phone, dc.created_at desc;

update public.deal_conversations dc
set contact_id = c.id
from public.contacts c
where dc.contact_id is null
  and dc.org_id = c.org_id
  and dc.sender_phone = c.phone;

-- ---------------------------------------------------------------------------
-- 9. Preserve legacy messages/conversations by linking them to active chats.
--
-- This does not copy every legacy message into deal_conversations because the
-- current app already uses deal_conversations as the UI source of truth. It
-- backfills org/contact/deal on the legacy model and creates missing chat rows
-- only when there is no matching deal_conversation yet.
-- ---------------------------------------------------------------------------

update public.conversations cv
set org_id = d.org_id
from public.deals d
where cv.org_id is null
  and cv.deal_id = d.id
  and d.org_id is not null;

update public.conversations cv
set org_id = c.org_id
from public.contacts c
where cv.org_id is null
  and cv.contact_id = c.id
  and c.org_id is not null;

do $$
begin
  if (select org_count from _backfill_context) > 1 and exists (
    select 1 from public.conversations where org_id is null
    union all
    select 1 from public.messages where org_id is null
  ) then
    raise exception 'Backfill aborted: ambiguous tenant data remains in conversations/messages. Provide explicit org_id mapping before running.';
  end if;
end $$;

update public.conversations
set org_id = (select single_org_id from _backfill_context where org_count = 1)
where org_id is null;

update public.messages m
set org_id = cv.org_id
from public.conversations cv
where m.org_id is null
  and m.conversation_id = cv.id
  and cv.org_id is not null;

update public.messages m
set org_id = d.org_id
from public.deals d
where m.org_id is null
  and m.deal_id = d.id
  and d.org_id is not null;

update public.messages
set org_id = (select single_org_id from _backfill_context where org_count = 1)
where org_id is null;

insert into public.deal_conversations (
  org_id,
  deal_id,
  contact_id,
  chat_id,
  sender_phone,
  content,
  sender_type,
  source,
  external_message_id,
  message_type,
  metadata,
  created_at
)
select
  m.org_id,
  coalesce(m.deal_id, cv.deal_id),
  coalesce(m.contact_id, cv.contact_id),
  case
    when cv.phone is not null and position('@' in cv.phone) > 0 then cv.phone
    when cv.phone is not null then regexp_replace(cv.phone, '\D', '', 'g') || '@c.us'
    else coalesce(m.conversation_id::text, m.id::text)
  end,
  cv.phone,
  coalesce(m.content, '[Mensagem sem texto]'),
  case when m.direction = 'outbound' then 'sales' else 'client' end,
  coalesce(m.source, cv.source, 'whatsapp'),
  m.wa_id,
  coalesce(m.message_type, 'text'),
  coalesce(m.metadata, '{}'::jsonb),
  coalesce(m.external_timestamp, m.created_at)
from public.messages m
left join public.conversations cv on cv.id = m.conversation_id
where m.org_id is not null
  and m.content is not null
  and not exists (
    select 1
    from public.deal_conversations dc
    where dc.org_id = m.org_id
      and (
        (m.wa_id is not null and dc.external_message_id = m.wa_id)
        or (
          m.wa_id is null
          and dc.created_at = coalesce(m.external_timestamp, m.created_at)
          and dc.content = m.content
          and coalesce(dc.deal_id, '00000000-0000-0000-0000-000000000000'::uuid)
              = coalesce(m.deal_id, cv.deal_id, '00000000-0000-0000-0000-000000000000'::uuid)
        )
      )
  );

-- ---------------------------------------------------------------------------
-- 10. Backfill org_id for operational tables derived from deals/campaigns.
-- ---------------------------------------------------------------------------

update public.tasks t
set org_id = d.org_id
from public.deals d
where t.org_id is null
  and t.deal_id = d.id
  and d.org_id is not null;

do $$
begin
  if (select org_count from _backfill_context) > 1 and exists (
    select 1 from public.tasks where org_id is null
    union all
    select 1 from public.campaigns where org_id is null
    union all
    select 1 from public.user_events where org_id is null
    union all
    select 1 from public.ai_feedback where org_id is null
  ) then
    raise exception 'Backfill aborted: ambiguous tenant data remains in operational tables. Provide explicit org_id mapping before running.';
  end if;
end $$;

update public.tasks
set org_id = (select single_org_id from _backfill_context where org_count = 1)
where org_id is null;

update public.campaigns
set org_id = (select single_org_id from _backfill_context where org_count = 1)
where org_id is null;

update public.user_events ue
set org_id = d.org_id
from public.deals d
where ue.org_id is null
  and ue.deal_id = d.id
  and d.org_id is not null;

update public.ai_feedback af
set org_id = d.org_id
from public.deals d
where af.org_id is null
  and af.deal_id = d.id
  and d.org_id is not null;

update public.user_events
set org_id = (select single_org_id from _backfill_context where org_count = 1)
where org_id is null;

update public.ai_feedback
set org_id = (select single_org_id from _backfill_context where org_count = 1)
where org_id is null;

-- ---------------------------------------------------------------------------
-- 11. Normalize timestamps and deal interaction summary.
-- ---------------------------------------------------------------------------

update public.deals d
set last_interaction_at = latest.last_message_at
from (
  select deal_id, max(created_at) as last_message_at
  from public.deal_conversations
  where deal_id is not null
  group by deal_id
) latest
where d.id = latest.deal_id
  and (d.last_interaction_at is null or d.last_interaction_at < latest.last_message_at);

update public.companies
set updated_at = coalesce(updated_at, created_at, now());

update public.contacts
set updated_at = coalesce(updated_at, created_at, now());

update public.deals
set updated_at = coalesce(updated_at, created_at, now());

-- ---------------------------------------------------------------------------
-- 12. Refresh AI usage history from current organization counters.
-- ---------------------------------------------------------------------------

insert into public.ai_usage_history (org_id, usage_date, ai_used, ai_saved_by_filter)
select
  o.id,
  current_date,
  coalesce(o.ai_used, 0),
  coalesce(o.ai_saved_by_filter, 0)
from public.organizations o
on conflict (org_id, usage_date) do update
set ai_used = greatest(public.ai_usage_history.ai_used, excluded.ai_used),
    ai_saved_by_filter = greatest(public.ai_usage_history.ai_saved_by_filter, excluded.ai_saved_by_filter);

commit;
