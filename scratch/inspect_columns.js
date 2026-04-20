import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://taaxcvtsdpkatopavsto.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhYXhjdnRzZHBrYXRvcGF2c3RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2ODkwOTMsImV4cCI6MjA5MTI2NTA5M30.9oop0xMgHbqOwNXHwTbeC-AJxEqraWz7DUUTMqlLfKk'
);

async function inspectTable() {
  // Use a query that forces schema inspection if possible, or just look at error info
  const { data, error } = await supabase.from('webhook_logs').select('*');
  console.log('Erro ao selecionar:', error);
  console.log('Colunas retornadas (se houver):', data ? Object.keys(data[0] || {}) : 'Nenhuma');
}

inspectTable();
