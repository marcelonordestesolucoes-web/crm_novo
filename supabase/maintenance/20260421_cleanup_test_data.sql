begin;

create schema if not exists backup_pre_cleanup_20260421;

create table if not exists backup_pre_cleanup_20260421.ai_interactions as table public.ai_interactions;
create table if not exists backup_pre_cleanup_20260421.ai_strategy_performance as table public.ai_strategy_performance;
create table if not exists backup_pre_cleanup_20260421.campaign_leads as table public.campaign_leads;
create table if not exists backup_pre_cleanup_20260421.campaigns as table public.campaigns;
create table if not exists backup_pre_cleanup_20260421.companies as table public.companies;
create table if not exists backup_pre_cleanup_20260421.contacts as table public.contacts;
create table if not exists backup_pre_cleanup_20260421.deal_attachments as table public.deal_attachments;
create table if not exists backup_pre_cleanup_20260421.deal_contacts as table public.deal_contacts;
create table if not exists backup_pre_cleanup_20260421.deal_conversations as table public.deal_conversations;
create table if not exists backup_pre_cleanup_20260421.deal_notes as table public.deal_notes;
create table if not exists backup_pre_cleanup_20260421.deal_timeline as table public.deal_timeline;
create table if not exists backup_pre_cleanup_20260421.deals as table public.deals;
create table if not exists backup_pre_cleanup_20260421.invitations as table public.invitations;
create table if not exists backup_pre_cleanup_20260421.member_goals as table public.member_goals;
create table if not exists backup_pre_cleanup_20260421.org_goals as table public.org_goals;
create table if not exists backup_pre_cleanup_20260421.tasks as table public.tasks;
create table if not exists backup_pre_cleanup_20260421.user_events as table public.user_events;
create table if not exists backup_pre_cleanup_20260421.webhook_logs as table public.webhook_logs;
create table if not exists backup_pre_cleanup_20260421.whatsapp_thread_aliases as table public.whatsapp_thread_aliases;
create table if not exists backup_pre_cleanup_20260421.storage_objects as
  select *
  from storage.objects
  where bucket_id in ('whatsapp_media', 'deal-attachments');

truncate table
  public.ai_interactions,
  public.ai_strategy_performance,
  public.campaign_leads,
  public.campaigns,
  public.companies,
  public.contacts,
  public.deal_attachments,
  public.deal_contacts,
  public.deal_conversations,
  public.deal_notes,
  public.deal_timeline,
  public.deals,
  public.invitations,
  public.member_goals,
  public.org_goals,
  public.tasks,
  public.user_events,
  public.webhook_logs,
  public.whatsapp_thread_aliases
restart identity cascade;

commit;
