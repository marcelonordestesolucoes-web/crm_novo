// Hook: useSearch
// Encapsula toda a lógica de busca para evitar duplicação nas views.
// Uso:
//   const { query, setQuery, filtered } = useSearch(items, ['name', 'company']);

import { useState, useMemo } from 'react';

export const useSearch = (items = [], keys = []) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const lower = query.toLowerCase();
    return items.filter((item) =>
      keys.some((key) => {
        const value = item[key];
        return typeof value === 'string' && value.toLowerCase().includes(lower);
      })
    );
  }, [items, keys, query]);

  return { query, setQuery, filtered };
};
