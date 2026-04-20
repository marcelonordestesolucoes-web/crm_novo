import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://taaxcvtsdpkatopavsto.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhYXhjdnRzZHBrYXRvcGF2c3RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2ODkwOTMsImV4cCI6MjA5MTI2NTA5M30.9oop0xMgHbqOwNXHwTbeC-AJxEqraWz7DUUTMqlLfKk'
);

async function finalAudit() {
  console.log('--- [AUDITORIA FINAL DE MENSAGENS] ---');
  
  const { data: logs, error: logErr } = await supabase
    .from('webhook_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  const { data: msgs, error: msgErr } = await supabase
    .from('deal_conversations')
    .select('id, content, chat_id, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('--- ÚLTIMOS LOGS ---');
  if (logs && logs.length > 0) {
    logs.forEach(l => console.log(`[${l.created_at}] Status: ${l.status} | Phone: ${l.sender_phone}`));
  } else {
    console.log('Nenhum log encontrado.');
  }

  console.log('--- ÚLTIMAS MENSAGENS ---');
  if (msgs && msgs.length > 0) {
    msgs.forEach(m => console.log(`[${m.created_at}] Chat: ${m.chat_id} | Content: ${m.content.substring(0, 30)}...`));
  } else {
    console.log('Nenhuma mensagem encontrada.');
  }
}

finalAudit();
