import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://taaxcvtsdpkatopavsto.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhYXhjdnRzZHBrYXRvcGF2c3RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2ODkwOTMsImV4cCI6MjA5MTI2NTA5M30.9oop0xMgHbqOwNXHwTbeC-AJxEqraWz7DUUTMqlLfKk'
);

async function checkAnyLogs() {
  const { count } = await supabase.from('webhook_logs').select('*', { count: 'exact', head: true });
  console.log('Total de logs encontrados:', count);
}

checkAnyLogs();
