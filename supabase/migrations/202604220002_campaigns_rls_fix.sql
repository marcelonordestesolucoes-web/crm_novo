begin;

alter table public.campaigns enable row level security;

drop policy if exists "campaigns_select_by_membership" on public.campaigns;
create policy "campaigns_select_by_membership"
  on public.campaigns
  for select
  using (
    exists (
      select 1
      from public.memberships m
      where m.org_id = campaigns.org_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "campaigns_insert_by_membership" on public.campaigns;
create policy "campaigns_insert_by_membership"
  on public.campaigns
  for insert
  with check (
    exists (
      select 1
      from public.memberships m
      where m.org_id = campaigns.org_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "campaigns_update_by_membership" on public.campaigns;
create policy "campaigns_update_by_membership"
  on public.campaigns
  for update
  using (
    exists (
      select 1
      from public.memberships m
      where m.org_id = campaigns.org_id
        and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.memberships m
      where m.org_id = campaigns.org_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "campaigns_delete_by_membership" on public.campaigns;
create policy "campaigns_delete_by_membership"
  on public.campaigns
  for delete
  using (
    exists (
      select 1
      from public.memberships m
      where m.org_id = campaigns.org_id
        and m.user_id = auth.uid()
    )
  );

commit;
