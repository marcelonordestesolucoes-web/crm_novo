import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://taaxcvtsdpkatopavsto.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhYXhjdnRzZHBrYXRvcGF2c3RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2ODkwOTMsImV4cCI6MjA5MTI2NTA5M30.9oop0xMgHbqOwNXHwTbeC-AJxEqraWz7DUUTMqlLfKk'
);

async function findTestMsg() {
  console.log('--- [PROCURANDO MENSAGEM DE TESTE NO BANCO] ---');

  const { data: messages, error } = await supabase
    .from('deal_conversations')
    .select('id, content, chat_id, sender_name, created_at')
    .ilike('content', '%TESTE DE CONEXÃO DIRETA AGORA%')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro na busca:', error.message);
    return;
  }

  if (messages && messages.length > 0) {
    console.log(`SUCESSO! A mensagem foi gravada às ${messages[0].created_at}`);
    console.log(`Chat ID gravado: ${messages[0].chat_id}`);
    console.log(`Remetente: ${messages[0].sender_name}`);
  } else {
    console.log('FALHA: A mensagem não foi encontrada na tabela deal_conversations.');
  }
}

findTestMsg();
