async function clearQueue() {
  const instanceId = '3F1C97713DB441CDA799AAE399BC1248';
  const token = 'A9CC72CBA1D787189E111426'; // Tentando sem o 'c' extra do texto
  const baseUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}/queue`;

  console.log('--- INICIANDO LIMPEZA DE FILA Z-API ---');

  try {
    // 1. Ver o que tem na fila
    console.log('Consultando fila...');
    const getRes = await fetch(baseUrl);
    const queueData = await getRes.json();
    console.log('Quantidade na fila:', queueData.length || 0);

    // 2. Limpar a fila
    console.log('Limpando fila...');
    const delRes = await fetch(baseUrl, { method: 'DELETE' });
    const delData = await delRes.json();
    
    console.log('Resultado da limpeza:', delData);
    console.log('--- TUDO DESTRAVADO! ✅ ---');
  } catch (error) {
    console.error('Erro ao limpar fila:', error.message);
    
    // Tentar com o token alternativo se falhar
    console.log('Tentando com token alternativo...');
    const tokenAlt = 'A9CC72CBA1D787189E111426c';
    const baseUrlAlt = `https://api.z-api.io/instances/${instanceId}/token/${tokenAlt}/queue`;
    try {
      const delResAlt = await fetch(baseUrlAlt, { method: 'DELETE' });
      const delDataAlt = await delResAlt.json();
      console.log('Resultado (Token Alt):', delDataAlt);
    } catch (e2) {
      console.error('Falha total nos tokens:', e2.message);
    }
  }
}

clearQueue();
