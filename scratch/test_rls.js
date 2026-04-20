import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://taaxcvtsdpkatopavsto.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhYXhjdnRzZHBrYXRvcGF2c3RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2ODkwOTMsImV4cCI6MjA5MTI2NTA5M30.9oop0xMgHbqOwNXHwTbeC-AJxEqraWz7DUUTMqlLfKk'
);

async function checkRLS() {
  const { data, error } = await supabase.rpc('get_service_role_config'); // This probably won't work
  // Let's just try to insert one row from here and see the error
  const { error: insErr } = await supabase.from('webhook_logs').insert({
    status: 'TESTE_PERMISSAO'
  });

  if (insErr) {
    console.log('ERRO DE INSERÇÃO (Possível RLS):', insErr.message);
  } else {
    console.log('Inserção via script funcionou!');
  }
}

checkRLS();
