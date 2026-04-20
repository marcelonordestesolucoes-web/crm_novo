async function simulate() {
  const url = 'https://taaxcvtsdpkatopavsto.supabase.co/functions/v1/whatsapp-webhook?token=EBW2026';
  
  const payload = {
    chatId: '120363025@g.us', // Grupo de teste
    message: {
      key: {
        remoteJid: '120363025@g.us',
        fromMe: false,
        id: 'SIMULATION_' + Date.now(),
        participant: '5511988887777@s.whatsapp.net'
      },
      conversation: 'TESTE DE CONEXÃO: O Backend está 100% OK! ✅',
      pushName: 'Simulador Antigravity'
    },
    senderName: 'Simulador Antigravity',
    groupName: 'Amigos do Abdias soccer ⚽'
  };

  console.log('--- ENVIANDO TESTE SIMULADO PARA O WEBHOOK ---');
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    console.log('Resposta do Servidor:', data);
    console.log('--- TESTE CONCLUÍDO COM SUCESSO ---');
  } catch (error) {
    console.error('Erro no Teste:', error.message);
  }
}

simulate();
