import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://taaxcvtsdpkatopavsto.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhYXhjdnRzZHBrYXRvcGF2c3RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2ODkwOTMsImV4cCI6MjA5MTI2NTA5M30.9oop0xMgHbqOwNXHwTbeC-AJxEqraWz7DUUTMqlLfKk'
);

async function checkNewMessage() {
  console.log('--- [BUSCANDO MENSAGEM DE TESTE: "Imagina a seleção"] ---');

  const { data: messages, error } = await supabase
    .from('deal_conversations')
    .select('id, sender_name, chat_id, content, created_at')
    .ilike('content', '%Imagina a seleção%')
    .limit(1);

  if (error) {
    console.error('Erro na busca:', error.message);
    return;
  }

  if (messages && messages.length > 0) {
    console.log('MENSAGEM ENCONTRADA!');
    console.log(`[${messages[0].created_at}] ChatID: ${messages[0].chat_id}`);
    console.log(`Remetente: ${messages[0].sender_name}`);
  } else {
    console.log('MENSAGEM NÃO ENCONTRADA NO BANCO.');
    
    // Check logs for errors
    const { data: logs } = await supabase
      .from('webhook_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    console.log('\nÚltimos logs do Webhook:');
    logs?.forEach(l => {
      console.log(`[${l.created_at}] Status: ${l.status} | Erro: ${l.error_message || 'Nenhum'}`);
    });
  }
}

checkNewMessage();
