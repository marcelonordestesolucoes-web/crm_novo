import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://taaxcvtsdpkatopavsto.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhYXhjdnRzZHBrYXRvcGF2c3RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2ODkwOTMsImV4cCI6MjA5MTI2NTA5M30.9oop0xMgHbqOwNXHwTbeC-AJxEqraWz7DUUTMqlLfKk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: deals, error } = await supabase.from('deals').select('*');
  if (error) {
    console.error('Error fetching deals:', error);
  } else {
    console.log('Total deals nas tabela (sem RLS por ser Anon):', deals.length);
    console.log(deals);
  }
}

check();
