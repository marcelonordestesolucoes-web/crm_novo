import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://taaxcvtsdpkatopavsto.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhYXhjdnRzZHBrYXRvcGF2c3RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2ODkwOTMsImV4cCI6MjA5MTI2NTA5M30.9oop0xMgHbqOwNXHwTbeC-AJxEqraWz7DUUTMqlLfKk'
);

async function investigate() {
  console.log('--- [INVESTIGAÇÃO DE MIXUP: ANA PAULA VS JULIANA] ---');

  // Buscar contatos
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, name, phone')
    .ilike('name', '%Juliana%')
    .or('name.ilike.%Ana Paula%,name.ilike.%anapaula%');

  console.log('Contatos:', contacts);

  // Buscar mensagens com mídia (notebook photo)
  const { data: messages } = await supabase
    .from('deal_conversations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  console.log('\nÚltimas 20 mensagens:');
  messages?.forEach(m => {
    const contact = contacts?.find(c => c.id === m.contact_id);
    console.log(`[${m.created_at}] Remetente (Webhook): ${m.sender_name} | Dono (Tabela): ${contact?.name || 'DESCONHECIDO'} | Phone: ${m.sender_phone}`);
  });
}

investigate();
