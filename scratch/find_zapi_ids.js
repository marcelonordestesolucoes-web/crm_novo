import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://taaxcvtsdpkatopavsto.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhYXhjdnRzZHBrYXRvcGF2c3RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2ODkwOTMsImV4cCI6MjA5MTI2NTA5M30.9oop0xMgHbqOwNXHwTbeC-AJxEqraWz7DUUTMqlLfKk'
);

async function findMessages() {
  const ids = ['1314624054', 'AC5E4D67321BC114AE602E9CFB79578F'];
  
  console.log('--- BUSCANDO IDS ESPECÍFICOS: ' + ids.join(', ') + ' ---');

  // Busca em deal_conversations
  const { data: convs } = await supabase
    .from('deal_conversations')
    .select('*')
    .in('external_message_id', ids);

  // Busca em webhook_logs (pelo conteúdo do JSON)
  const { data: logs } = await supabase
    .from('webhook_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  console.log('--- RESULTADO DEAL_CONVERSATIONS ---');
  if (convs && convs.length > 0) {
    convs.forEach(c => console.log(`ACHEI! [${c.created_at}] Chat: ${c.chat_id} | Content: ${c.content}`));
  } else {
    console.log('Nenhuma correspondência em deal_conversations.');
  }

  console.log('--- ANÁLISE DOS WEBHOOK_LOGS ---');
  if (logs && logs.length > 0) {
    let foundInLogs = false;
    logs.forEach(l => {
      const payloadStr = JSON.stringify(l.payload);
      if (ids.some(id => payloadStr.includes(id))) {
        console.log(`ACHEI NO LOG! [${l.created_at}] Status: ${l.status}`);
        foundInLogs = true;
      }
    });
    if (!foundInLogs) console.log('Não encontrado nos últimos 50 logs.');
  }
}

findMessages();
