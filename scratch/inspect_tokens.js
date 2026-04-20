import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://taaxcvtsdpkatopavsto.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhYXhjdnRzZHBrYXRvcGF2c3RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2ODkwOTMsImV4cCI6MjA5MTI2NTA5M30.9oop0xMgHbqOwNXHwTbeC-AJxEqraWz7DUUTMqlLfKk'
);

async function inspectToken() {
  const { data: orgs } = await supabase.from('organizations').select('whatsapp_token');
  
  console.log('--- INSPEÇÃO DE TOKENS NO BANCO ---');
  orgs.forEach(o => {
    const t = o.whatsapp_token;
    console.log(`Token: "${t}" | Comprimento: ${t?.length} | Hex: ${[...t].map(c => c.charCodeAt(0).toString(16)).join(' ')}`);
  });
}

inspectToken();
