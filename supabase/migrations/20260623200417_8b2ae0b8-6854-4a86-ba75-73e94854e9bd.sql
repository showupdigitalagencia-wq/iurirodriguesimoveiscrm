
SELECT cron.schedule(
  'plantao-escalation-1min',
  '* * * * *',
  $$ SELECT net.http_post(
       url:='https://project--e52b7b78-95c4-4a32-a27d-fe22d3d5b291.lovable.app/api/public/hooks/plantao-escalation',
       headers:='{"Content-Type": "application/json"}'::jsonb,
       body:='{}'::jsonb
     ) as request_id; $$
);
