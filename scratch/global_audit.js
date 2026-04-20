import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://taaxcvtsdpkatopavsto.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhYXhjdnRzZHBrYXRvcGF2c3RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2ODkwOTMsImV4cCI6MjA5MTI2NTA5M30.9oop0xMgHbqOwNXHwTbeC-AJxEqraWz7DUUTMqlLfKk'
);

async function globalAudit() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  console.log('--- BUSCA GLOBAL (ÚLTIMA 1 HORA) ---');

  const { data: msgs } = await supabase
    .from('deal_conversations')
    .select('created_at, content, chat_id')
    .gt('created_at', oneHourAgo)
    .order('created_at', { ascending: false });

  if (msgs && msgs.length > 0) {
    console.log(`ACHEI ${msgs.length} MENSAGENS NO BANCO:`);
    msgs.forEach(m => console.log(`[${m.created_at}] Chat: ${m.chat_id} | Content: ${m.content.substring(0, 40)}...`));
  } else {
    console.log('Nenhuma mensagem encontrada na última 1 hora.');
  }

  const { data: logs } = await supabase
    .from('webhook_logs')
    .select('created_at, status, sender_phone')
    .gt('created_at', oneHourAgo);

  console.log('--- LOGS DE WEBHOOK (ÚLTIMA 1 HORA) ---');
  if (logs && logs.length > 0) {
    console.log(`ACHEI ${logs.length} LOGS:`);
    logs.forEach(l => console.log(`[${l.created_at}] Status: ${l.status}`));
  } else {
    console.log('Nenhum log de webhook encontrado.');
  }
}

globalAudit();
