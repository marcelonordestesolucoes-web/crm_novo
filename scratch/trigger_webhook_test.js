async function testWebhook() {
  const url = 'https://taaxcvtsdpkatopavsto.supabase.co/functions/v1/whatsapp-webhook?token=EBW2026';
  
  const payload = {
    chatId: '5511999998888@c.us',
    senderName: 'TESTE_IA_DIRETO',
    from: '5511999998888@c.us',
    message: {
      conversation: 'TESTE DE CONEXÃO DIRETA AGORA'
    }
  };

  console.log('--- [TESTE DE CONEXÃO DIRETA] ---');
  console.log('Enviando para:', url);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    console.log('Resposta do Webhook:', res.status, data);
  } catch (err) {
    console.error('Erro ao conectar no Webhook:', err.message);
  }
}

testWebhook();
