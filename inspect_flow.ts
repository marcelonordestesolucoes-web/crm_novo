
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  const { data, error } = await supabase
    .from('automation_flows')
    .select('name, flow_json')
    .order('updated_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('--- FLOW INSPECTION ---');
  console.log('Flow Name:', data[0].name);
  const nodes = data[0].flow_json.nodes || [];
  
  nodes.forEach((node: any) => {
    console.log(`\nNode: ${node.id} (${node.type})`);
    console.log('Config:', JSON.stringify(node.config, null, 2));
  });
}

inspect();
