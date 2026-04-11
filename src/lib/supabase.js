// src/lib/supabase.js
// Instância única do cliente Supabase para toda a aplicação.
// Nunca instancie o cliente diretamente nas views — sempre importe daqui.

import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    '[Stitch] Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não encontradas.\n' +
    'Verifique o arquivo .env na raiz do projeto.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);
