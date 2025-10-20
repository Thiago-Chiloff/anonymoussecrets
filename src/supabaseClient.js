import { createClient } from '@supabase/supabase-js';

// Configuração otimizada do Supabase - CRIADO UMA ÚNICA VEZ
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Verifica se as variáveis de ambiente estão definidas
if (!supabaseUrl || !supabaseKey) {
  console.error('Variáveis de ambiente do Supabase não encontradas!');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: {
    reconnect: true,
    heartbeatInterval: 10000
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'supabase.auth.token'
  }
});