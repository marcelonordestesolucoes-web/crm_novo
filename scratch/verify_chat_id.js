import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://taaxcvtsdpkatopavsto.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhYXhjdnRzZHBrYXRvcGF2c3RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2ODkwOTMsImV4cCI6MjA5MTI2NTA5M30.9oop0xMgHbqOwNXHwTbeC-AJxEqraWz7DUUTMqlLfKk'
);

async function verify() {
  console.log('--- [VERIFICAÇÃO DE CHAT_ID] ---');

  const { data: messages, error } = await supabase
    .from('deal_conversations')
    .select('id, sender_name, chat_id, is_group, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Erro:', error.message);
    return;
  }

  messages.forEach(m => {
    console.log(`[${m.created_at}] Nome: ${m.sender_name} | ChatID: ${m.chat_id || 'null'} | IsGroup: ${m.is_group}`);
  });
}

verify();
