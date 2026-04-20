import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://taaxcvtsdpkatopavsto.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhYXhjdnRzZHBrYXRvcGF2c3RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2ODkwOTMsImV4cCI6MjA5MTI2NTA5M30.9oop0xMgHbqOwNXHwTbeC-AJxEqraWz7DUUTMqlLfKk'
);

async function analyze() {
  console.log('--- [DIAGNÓSTICO DE IDENTIDADE] ---');

  const names = ['Juliana Refeições', 'Ana Paula Silvestre', 'Ariane Alves', 'anapaulasilvestre'];
  
  const { data: contacts, error: err1 } = await supabase
    .from('contacts')
    .select('id, name, phone')
    .or(names.map(n => `name.ilike.%${n}%`).join(','));

  if (err1) {
    console.error('Erro ao buscar contatos:', err1);
    return;
  }

  console.log('Contatos encontrados:');
  contacts.forEach(c => {
    console.log(`ID: ${c.id} | Nome: ${c.name} | Telefone: ${c.phone}`);
  });

  const { data: messages, error: err2 } = await supabase
    .from('deal_conversations')
    .select('sender_name, sender_phone, contact_id, content')
    .ilike('content', '%notebook%') // Buscar pela mensagem da foto se tivesse texto, ou apenas as recentes
    .limit(5);

  const { data: recentMsgs } = await supabase
    .from('deal_conversations')
    .select('sender_name, sender_phone, contact_id, content, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('\nMensagens recentes:');
  recentMsgs?.forEach(m => {
    console.log(`[${m.created_at}] Remetente: ${m.sender_name} | Phone: ${m.sender_phone} | Contact ID: ${m.contact_id}`);
  });
}

analyze();
