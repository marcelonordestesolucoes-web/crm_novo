import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://taaxcvtsdpkatopavsto.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhYXhjdnRzZHBrYXRvcGF2c3RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2ODkwOTMsImV4cCI6MjA5MTI2NTA5M30.9oop0xMgHbqOwNXHwTbeC-AJxEqraWz7DUUTMqlLfKk'
);

async function checkOrg() {
  console.log('--- [VERIFICAÇÃO DE ORGANIZAÇÃO] ---');

  const { data: orgs, error } = await supabase
    .from('organizations')
    .select('id, name, whatsapp_token');

  if (error) {
    console.error('Erro ao buscar organizações:', error.message);
    return;
  }

  console.log('Organizações encontradas:');
  orgs.forEach(o => {
    console.log(`ID: ${o.id} | Nome: ${o.name} | Token: ${o.whatsapp_token}`);
  });
}

checkOrg();
