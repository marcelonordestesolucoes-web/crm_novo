import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function analyze() {
  console.log('--- [DIAGNÓSTICO DE IDENTIDADE] ---');

  // 1. Verificar Duplicidade de Telefones
  const { data: duplicates, error: err1 } = await supabase.rpc('execute_sql', { 
    sql: `SELECT phone, COUNT(*), array_agg(name) as names 
          FROM contacts 
          WHERE phone IS NOT NULL AND phone <> ''
          GROUP BY phone 
          HAVING COUNT(*) > 1` 
  });
  
  if (err1) {
    // Fallback se o rpc falhar
    const { data: allContacts } = await supabase.from('contacts').select('id, name, phone');
    const counts = {};
    allContacts?.forEach(c => {
      if (!c.phone) return;
      counts[c.phone] = counts[c.phone] || [];
      counts[c.phone].push(c.name);
    });
    console.log('Contatos com mesmo telefone:');
    Object.entries(counts).filter(([p, names]) => names.length > 1).forEach(([p, names]) => {
      console.log(`Telefone: ${p} | Nomes: ${names.join(', ')}`);
    });
  } else {
    console.log('Duplicados encontrados:', duplicates);
  }

  // 2. Verificar Mensagens da Ariane vs Juliana vs Ana Paula
  const namesToSearch = ['Ariane Alves', 'Juliana Refeições', 'Ana Paula Silvestre', 'ana paula silvestre'];
  const { data: messages } = await supabase
    .from('deal_conversations')
    .select('sender_name, sender_phone, contact_id, created_at')
    .in('sender_name', namesToSearch)
    .order('created_at', { ascending: false })
    .limit(20);

  console.log('\nÚltimas mensagens interceptadas:');
  messages?.forEach(m => {
    console.log(`[${m.created_at}] Nome: ${m.sender_name} | Phone: ${m.sender_phone} | Contact ID: ${m.contact_id}`);
  });
}

analyze();
