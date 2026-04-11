// src/hooks/useSupabase.js
// Hook genérico para qualquer chamada assíncrona ao Supabase.
// Gerencia estado de loading, error e dados de forma centralizada.
//
// Uso:
//   const { data: deals, loading, error, refetch } = useSupabase(getDeals);

import { useState, useEffect, useCallback } from 'react';

export function useSupabase(queryFn, deps = []) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await queryFn();
      setData(result);
    } catch (err) {
      console.error('[Stitch] Erro na query Supabase:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
