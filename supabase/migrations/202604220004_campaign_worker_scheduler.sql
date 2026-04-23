-- Stage 2: automatic scheduler for campaign worker.
-- Uses pg_cron + pg_net to call the Edge Function once per minute.

begin;

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;
create extension if not exists supabase_vault with schema vault;

do $$
declare
  existing_secret_id uuid;
begin
  select id into existing_secret_id
  from vault.secrets
  where name = 'campaign_worker_secret'
  limit 1;

  if existing_secret_id is null then
    perform vault.create_secret(
      encode(gen_random_bytes(32), 'hex'),
      'campaign_worker_secret',
      'Secret used by pg_cron to invoke campaign-worker safely.'
    );
  end if;
end $$;

select cron.unschedule(jobname)
from cron.job
where jobname = 'campaign-worker-every-minute';

select cron.schedule(
  'campaign-worker-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://taaxcvtsdpkatopavsto.supabase.co/functions/v1/campaign-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-campaign-worker-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'campaign_worker_secret' limit 1)
    ),
    body := jsonb_build_object('action', 'tick'),
    timeout_milliseconds := 25000
  );
  $$
);

commit;
