import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://taaxcvtsdpkatopavsto.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhYXhjdnRzZHBrYXRvcGF2c3RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2ODkwOTMsImV4cCI6MjA5MTI2NTA5M30.9oop0xMgHbqOwNXHwTbeC-AJxEqraWz7DUUTMqlLfKk'
);

async function checkFinal() {
  console.log('--- [VERIFICAÇÃO FINAL DE LOGS] ---');

  const { data: logs, count } = await supabase
    .from('webhook_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(3);

  console.log(`Total de logs após deploy: ${count}`);

  if (logs && logs.length > 0) {
    logs.forEach(l => {
      console.log(`[${l.created_at}] Status: ${l.status} | Phone: ${l.sender_phone}`);
    });
  } else {
    console.log('Ainda nenhum log. O Webhook pode não ter sido chamado desde o deploy.');
  }

  const { data: msgs } = await supabase
    .from('deal_conversations')
    .select('content, chat_id, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('\nÚltimas mensagens no banco:');
  msgs?.forEach(m => {
    console.log(`[${m.created_at}] ChatID: ${m.chat_id} | Msg: ${m.content.substring(0, 30)}`);
  });
}

checkFinal();
