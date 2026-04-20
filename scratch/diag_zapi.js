const instanceId = '3F1C97713DB441CDA799AAE399BC1248';
const token = 'A9CC72CBA1D787189E111426';
const phone = '208129837031653@lid'; 
const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`;

async function diagnostic() {
  console.log('--- INICIANDO DIAGNÓSTICO Z-API ---');
  console.log('URL de Destino:', url);
  console.log('ID do Destinatário:', phone);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, message: 'Teste de Diagnóstico Elite' })
    });
    
    const data = await res.json();
    console.log('Status HTTP:', res.status);
    console.log('Resposta da Z-API:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('ERRO NA REQUISIÇÃO:', err.message);
  }
}

diagnostic();
