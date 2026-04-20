async function testOutbound() {
  const instanceId = '3F1C97713DB441CDA799AAE399BC1248';
  const token = 'A9CC72CBA1D787189E111426';
  const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`;
  
  const payload = {
    phone: '5581981428495',
    message: '🚀 TESTE DE SAÍDA: O seu sistema está tentando falar com você! Se você recebeu isso, a Z-API está funcionando.'
  };

  console.log('--- TESTANDO SAÍDA DA Z-API ---');
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    console.log('Resposta da Z-API:', data);
    console.log('--- TESTE CONCLUÍDO ---');
  } catch (error) {
    console.error('Erro no Teste de Saída:', error.message);
  }
}

testOutbound();
