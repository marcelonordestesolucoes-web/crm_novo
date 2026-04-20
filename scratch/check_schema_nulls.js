import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://taaxcvtsdpkatopavsto.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhYXhjdnRzZHBrYXRvcGF2c3RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2ODkwOTMsImV4cCI6MjA5MTI2NTA5M30.9oop0xMgHbqOwNXHwTbeC-AJxEqraWz7DUUTMqlLfKk'
);

async function checkSchema() {
  const { data, error } = await supabase.rpc('get_column_info', { table_name: 'deal_conversations' });
  
  if (error) {
    // If RPC fails, try a direct query to check if we can insert nulls
    console.log('RPC failed, checking columns via query...');
    const { data: testData, error: testError } = await supabase
      .from('deal_conversations')
      .select('*')
      .limit(1);
    
    if (testError) {
      console.error('Error:', testError.message);
      return;
    }
    console.log('Columns found:', Object.keys(testData[0] || {}).join(', '));
  } else {
    console.log('Schema:', data);
  }
}

checkSchema();
