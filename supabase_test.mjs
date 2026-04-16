import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://taaxcvtsdpkatopavsto.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhYXhjdnRzZHBrYXRvcGF2c3RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2ODkwOTMsImV4cCI6MjA5MTI2NTA5M30.9oop0xMgHbqOwNXHwTbeC-AJxEqraWz7DUUTMqlLfKk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log('Testing getPipelines...');
  const res1 = await supabase.from('pipelines').select('*').order('created_at', { ascending: true });
  if (res1.error) console.error('Pipelines Error:', res1.error);
  else console.log('Pipelines Success:', res1.data.map(p => p.id));

  if (res1.data && res1.data.length > 0) {
    const pId = res1.data[0].id;
    console.log(`Testing getPipelineStages para ${pId}...`);
    const res2 = await supabase
      .from('pipeline_stages')
      .select('*')
      .eq('pipeline_id', pId)
      .order('sort_order', { ascending: true });
    
    if (res2.error) console.error('Stages Error:', res2.error);
    else console.log('Stages Success:', res2.data.length);
  }

  console.log('Testing getDeals...');
  const res3 = await supabase.from('deals').select('id, title, stage').order('created_at', { ascending: false }).limit(2);
  if (res3.error) console.error('Deals Error:', res3.error);
  else console.log('Deals Success:', res3.data);
}

test();
