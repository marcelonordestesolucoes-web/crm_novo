import { supabase } from './src/lib/supabase.js';

async function checkTables() {
  try {
    const { data: pData, error: pError } = await supabase.from('profiles').select('*').limit(1);
    console.log('Profiles table exists:', !pError);
    
    const { data: iData, error: iError } = await supabase.from('invitations').select('*').limit(1);
    console.log('Invitations table exists:', !iError);

    const { data: mData, error: mError } = await supabase.from('memberships').select('*').limit(1);
    console.log('Memberships table exists:', !mError);
  } catch (e) {
    console.error('Error checking tables:', e);
  }
}

checkTables();
