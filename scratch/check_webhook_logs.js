import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://taaxcvtsdpkatopavsto.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhYXhjdnRzZHBrYXRvcGF2c3RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2ODkwOTMsImV4cCI6MjA5MTI2NTA5M30.9oop0xMgHbqOwNXHwTbeC-AJxEqraWz7DUUTMqlLfKk'
);

async function checkLogs() {
  console.log('--- [ANÁLISE DE LOGS DO WEBHOOK] ---');
  
  const { data: logs, error } = await supabase
    .from('webhook_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Erro ao buscar logs:', error);
    return;
  }

  logs.forEach((log, i) => {
    console.log(`\nLOG #${i+1} [${log.created_at}] STATUS: ${log.status}`);
    console.log(`PHONE EXTRAÍDO: ${log.sender_phone}`);
    console.log(`PAYLOAD: ${JSON.stringify(log.payload, null, 2).substring(0, 500)}...`);
  });
}

checkLogs();
