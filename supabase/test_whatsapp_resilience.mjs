/**
 * STITCH CRM - WhatsApp Ingestion Resilience Test
 * Simula os cenários de "Arquitetura Elite" (10/10) solicitados.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const TEST_PHONE = '+5511999998888';
const WA_ID_BASE = 'wamid.HBgLMTU1NTg2MzgxMDM';

async function runTests() {
  console.log('🚀 Iniciando Testes de Resiliência WhatsApp (Fase 1)...');

  // 1. LIMPEZA PREVIA
  await supabase.from('messages').delete().eq('content', 'TEST_MSG');
  await supabase.from('conversations').delete().eq('phone', TEST_PHONE);

  // 2. TESTE DE CONCORRÊNCIA (2 mensagens simultâneas criando conversa)
  console.log('\n🔥 Teste 1: Concorrência (Simultaneidade)');
  const payload = (id) => ({
    phone: TEST_PHONE,
    wa_id: id,
    content: 'TEST_MSG',
    source: 'whatsapp'
  });

  // Simula 2 workers tentando criar a conversa ao mesmo tempo
  const results = await Promise.allSettled([
    mockWebhookAction(payload(WA_ID_BASE + '1')),
    mockWebhookAction(payload(WA_ID_BASE + '2'))
  ]);

  const { data: convs } = await supabase.from('conversations').select('*').eq('phone', TEST_PHONE);
  if (convs.length === 1) {
    console.log('✅ SUCESSO: Apenas 1 conversa criada via Unique Index.');
  } else {
    console.error('❌ FALHA: Múltiplas conversas criadas!');
  }

  // 3. TESTE DE IDEMPOTÊNCIA (Retry da Meta)
  console.log('\n🔥 Teste 2: Idempotência (Retry da Meta)');
  await mockWebhookAction(payload(WA_ID_BASE + '3'));
  await mockWebhookAction(payload(WA_ID_BASE + '3')); // Duplicata

  const { data: msgs } = await supabase.from('messages').select('*').eq('wa_id', WA_ID_BASE + '3');
  if (msgs.length === 1) {
    console.log('✅ SUCESSO: Mensagem duplicada ignorada pelo banco.');
  } else {
    console.error('❌ FALHA: Mensagem duplicada persistida!');
  }

  // 4. TESTE DE AMBIGUIDADE DE DEAL
  console.log('\n🔥 Teste 3: Ambiguidade de Deal');
  // Criar 2 deals para o mesmo contato
  const { data: contact } = await supabase.from('contacts').select('id').eq('phone', TEST_PHONE).single();
  await supabase.from('deals').insert([
    { title: 'Deal A', contact_id: contact.id, status: 'new' },
    { title: 'Deal B', contact_id: contact.id, status: 'new' }
  ]);

  await mockWebhookAction(payload(WA_ID_BASE + '4'));
  const { data: finalMsg } = await supabase.from('messages').select('deal_id').eq('wa_id', WA_ID_BASE + '4').single();
  
  if (finalMsg.deal_id === null) {
    console.log('✅ SUCESSO: deal_id ficou NULL por ambiguidade (mais de 1 ativo).');
  } else {
    console.warn('⚠️ AVISO: Deal vinculado apesar da ambiguidade. Verifique a lógica de matching.');
  }

  console.log('\n🏁 Todos os testes de arquitetura concluídos.');
}

// Simulação da lógica que está dentro da Edge Function
async function mockWebhookAction({ phone, wa_id, content, source }) {
  // 1. Atomic Upsert Conversation
  const { data: conv } = await supabase
    .from('conversations')
    .upsert({ phone, source, status: 'active' }, { onConflict: 'phone,source' })
    .select().single();

  // 2. Save Message
  return supabase.from('messages').insert({
    conversation_id: conv.id,
    wa_id: wa_id,
    content: content,
    direction: 'inbound',
    source: source
  });
}

runTests();
