import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AppWindow,
  BadgeHelp,
  Bot,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Equal,
  Flag,
  FileText,
  GitBranch,
  Image,
  Link2,
  MessageCircle,
  MessageSquareQuote,
  Mic,
  PlusCircle,
  Tags,
  UserPlus,
  UserRoundCheck,
  Video,
  Workflow,
  XCircle
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { LoadingSpinner, Modal } from '@/components/ui';
import FlowCanvas from './components/FlowCanvas';
import FlowToolbar from './components/FlowToolbar';
import { createDefaultFlowJson, createFlowLog, getFlowById, normalizeFlowJson, saveFlow } from '@/services/flows';
import { cn } from '@/lib/utils';

const BLOCK_DEFINITIONS = {
  trigger_start: {
    type: 'trigger_start',
    title: 'Inicio do fluxo',
    group: 'Gatilho',
    icon: Flag,
    iconWrapClass: 'bg-emerald-50 text-emerald-600',
    description: 'Ponto inicial do fluxo.',
    createConfig: () => ({}),
    getSummary: () => 'Entrada principal da automacao.'
  },
  trigger_message_received: {
    type: 'trigger_message_received',
    title: 'Mensagem recebida',
    group: 'Gatilho',
    icon: MessageCircle,
    iconWrapClass: 'bg-emerald-50 text-emerald-600',
    description: 'Dispara quando uma nova mensagem chega.',
    createConfig: () => ({ channel: 'whatsapp', keyword: '' }),
    getSummary: (config) => config.keyword ? `Escuta mensagens com "${config.keyword}".` : 'Escuta novas mensagens do canal.'
  },
  trigger_new_contact: {
    type: 'trigger_new_contact',
    title: 'Novo contato',
    group: 'Gatilho',
    icon: UserPlus,
    iconWrapClass: 'bg-emerald-50 text-emerald-600',
    description: 'Dispara na criacao de contato.',
    createConfig: () => ({ source: '' }),
    getSummary: (config) => config.source ? `Contato vindo de ${config.source}.` : 'Novo contato entrando no CRM.'
  },
  trigger_new_lead: {
    type: 'trigger_new_lead',
    title: 'Novo lead',
    group: 'Gatilho',
    icon: UserRoundCheck,
    iconWrapClass: 'bg-emerald-50 text-emerald-600',
    description: 'Dispara quando um lead e criado.',
    createConfig: () => ({ pipeline: '' }),
    getSummary: (config) => config.pipeline ? `Novo lead no pipeline ${config.pipeline}.` : 'Novo lead qualificado ou capturado.'
  },
  send_message: {
    type: 'send_message',
    title: 'Enviar mensagem',
    group: 'Mensagem',
    icon: MessageCircle,
    iconWrapClass: 'bg-primary/10 text-primary',
    description: 'Envia uma mensagem simples.',
    createConfig: () => ({ message: '', typing_seconds: '0', mark_as_forwarded: false, text_activated: false }),
    getSummary: (config) => config.message || 'Mensagem ainda nao configurada.'
  },
  send_link: {
    type: 'send_link',
    title: 'Enviar Link',
    group: 'Mensagem',
    icon: Link2,
    iconWrapClass: 'bg-primary/10 text-primary',
    description: 'Envia um link com preview e texto opcional.',
    createConfig: () => ({
      link_url: '',
      link_activated: false,
      message: '',
      text_activated: false,
      typing_seconds: '0'
    }),
    getSummary: (config) => config.link_url || 'Link ainda nao configurado.'
  },
  send_video: {
    type: 'send_video',
    title: 'Enviar video',
    group: 'Midia',
    icon: Video,
    iconWrapClass: 'bg-violet-100 text-violet-600',
    description: 'Envia um video com legenda opcional.',
    createConfig: () => ({
      video_source: 'file',
      video_name: '',
      video_link: '',
      video_ready: false,
      video_uploading: false,
      show_link_input: false,
      format: 'padrao',
      message: '',
      text_activated: false,
      mark_as_forwarded: false,
      typing_seconds: '0'
    }),
    getSummary: (config) => config.video_name || config.video_link || 'Video ainda nao configurado.'
  },
  send_image: {
    type: 'send_image',
    title: 'Enviar imagem',
    group: 'Midia',
    icon: Image,
    iconWrapClass: 'bg-violet-100 text-violet-600',
    description: 'Envia uma imagem com legenda opcional.',
    createConfig: () => ({
      image_source: 'file',
      image_name: '',
      image_link: '',
      image_ready: false,
      image_uploading: false,
      show_link_input: false,
      format: 'padrao',
      message: '',
      text_activated: false,
      mark_as_forwarded: false,
      typing_seconds: '0'
    }),
    getSummary: (config) => config.image_name || config.image_link || 'Imagem ainda nao configurada.'
  },
  send_audio: {
    type: 'send_audio',
    title: 'Enviar audio',
    group: 'Midia',
    icon: Mic,
    iconWrapClass: 'bg-violet-100 text-violet-600',
    description: 'Envia um audio com legenda opcional.',
    createConfig: () => ({
      audio_source: 'file',
      audio_name: '',
      audio_link: '',
      audio_ready: false,
      audio_uploading: false,
      show_link_input: false,
      message: '',
      text_activated: false,
      mark_as_forwarded: false,
      recording_seconds: '0'
    }),
    getSummary: (config) => config.audio_name || config.audio_link || 'Audio ainda nao configurado.'
  },
  send_document: {
    type: 'send_document',
    title: 'Enviar documento',
    group: 'Midia',
    icon: FileText,
    iconWrapClass: 'bg-violet-100 text-violet-600',
    description: 'Envia um documento com texto opcional.',
    createConfig: () => ({
      document_source: 'file',
      document_name: '',
      document_link: '',
      document_ready: false,
      document_uploading: false,
      show_link_input: false,
      message: '',
      text_activated: false,
      mark_as_forwarded: false,
      typing_seconds: '0'
    }),
    getSummary: (config) => config.document_name || config.document_link || 'Documento ainda nao configurado.'
  },
  ask_question: {
    type: 'ask_question',
    title: 'Fazer pergunta',
    group: 'Mensagem',
    icon: MessageSquareQuote,
    iconWrapClass: 'bg-primary/10 text-primary',
    description: 'Faz uma pergunta e espera resposta.',
    createConfig: () => ({ message: '', response_type: 'texto', timeout_minutes: '', typing_seconds: '0', mark_as_forwarded: false }),
    getSummary: (config) => config.message || 'Pergunta aguardando configuracao.'
  },
  send_options: {
    type: 'send_options',
    title: 'Enviar opcoes',
    group: 'Mensagem',
    icon: PlusCircle,
    iconWrapClass: 'bg-primary/10 text-primary',
    description: 'Apresenta opcoes ao contato.',
    createConfig: () => ({
      message: 'Voce ja e nosso cliente?',
      format: 'botoes',
      response_key: 'selecione',
      list_title: 'Selecione as opcoes abaixo:',
      options: 'Sim\nNao',
      timeout_seconds: '0',
      typing_seconds: '0',
      mark_as_forwarded: false
    }),
    getSummary: (config) => config.options ? `${String(config.options).split('\n').filter(Boolean).length} opcoes configuradas.` : 'Nenhuma opcao definida.'
  },
  send_copy_code: {
    type: 'send_copy_code',
    title: 'Enviar Copia e Cola',
    group: 'Mensagem',
    icon: FileText,
    iconWrapClass: 'bg-primary/10 text-primary',
    description: 'Envia uma mensagem com um codigo copiavel.',
    createConfig: () => ({
      message: '',
      code_label: 'Codigo:',
      code: '',
      button_label: 'Copiar codigo'
    }),
    getSummary: (config) => config.code || config.message || 'Codigo ainda nao configurado.'
  },
  send_action_buttons: {
    type: 'send_action_buttons',
    title: 'Enviar acoes',
    group: 'Mensagem',
    icon: Bot,
    iconWrapClass: 'bg-primary/10 text-primary',
    description: 'Envia botoes de acao com link ou telefone.',
    createConfig: () => ({
      title: '',
      description: '',
      footer: '',
      actions: [
        { type: 'link', title: '', value: '' }
      ]
    }),
    getSummary: (config) => config.title || `${Array.isArray(config.actions) ? config.actions.length : 0} acoes configuradas.`
  },
  integration_external_call: {
    type: 'integration_external_call',
    title: 'Chamada externa',
    group: 'Integracao',
    icon: Workflow,
    iconWrapClass: 'bg-sky-100 text-sky-600',
    description: 'Executa uma requisicao HTTP externa.',
    createConfig: () => ({
      method: 'GET',
      url: '',
      headers: [],
      body: '',
      response: '',
      field_mappings: []
    }),
    getSummary: (config) => config.url || 'Requisicao ainda nao configurada.'
  },
  condition_contains_text: {
    type: 'condition_contains_text',
    title: 'Contem texto',
    group: 'Condição',
    icon: GitBranch,
    iconWrapClass: 'bg-amber-50 text-amber-600',
    description: 'Valida se o texto recebido contem um valor.',
    createConfig: () => ({ value: '', true_label: 'Sim', false_label: 'Nao' }),
    getSummary: (config) => config.value ? `Segue no sim se contiver "${config.value}".` : 'Condicao de texto ainda nao definida.'
  },
  condition_equals_value: {
    type: 'condition_equals_value',
    title: 'Igual a valor',
    group: 'Condição',
    icon: Equal,
    iconWrapClass: 'bg-amber-50 text-amber-600',
    description: 'Compara um campo a um valor exato.',
    createConfig: () => ({ field: '', value: '', true_label: 'Sim', false_label: 'Nao' }),
    getSummary: (config) => (config.field && config.value) ? `${config.field} igual a ${config.value}.` : 'Comparacao exata pendente.'
  },
  condition_validation: {
    type: 'condition_validation',
    title: 'Validar Formato',
    group: 'Condição',
    icon: CheckCircle2,
    iconWrapClass: 'bg-amber-50 text-amber-600',
    description: 'Valida CPF/CNPJ, Email ou Numeros.',
    createConfig: () => ({ validation_type: 'cpf_cnpj', exact_length: '', max_retries: '3', true_label: 'Valido', retry_label: 'Tentar N.', false_label: 'Falhou' }),
    getSummary: (config) => config.validation_type ? `Valida formato ${config.validation_type}.` : 'Regra nao configurada.'
  },
  action_validation: {
    type: 'condition_validation',
    title: 'Validar Formato',
    group: 'Condição',
    icon: CheckCircle2,
    iconWrapClass: 'bg-amber-50 text-amber-600',
    description: 'Valida CPF/CNPJ, Email ou Numeros.',
    createConfig: () => ({ validation_type: 'cpf_cnpj', exact_length: '', max_retries: '3', true_label: 'Valido', retry_label: 'Tentar N.', false_label: 'Falhou' }),
    getSummary: (config) => config.validation_type ? `Valida formato ${config.validation_type}.` : 'Regra nao configurada.'
  },
  condition_business_hours: {
    type: 'condition_business_hours',
    title: 'Horario comercial',
    group: 'Condição',
    icon: Clock3,
    iconWrapClass: 'bg-amber-50 text-amber-600',
    description: 'Diferencia atendimento dentro e fora do horario.',
    createConfig: () => ({ start_time: '08:00', end_time: '18:00', true_label: 'Dentro', false_label: 'Fora' }),
    getSummary: (config) => `Janela ${config.start_time || '08:00'} ate ${config.end_time || '18:00'}.`
  },
  condition_contact_has_tag: {
    type: 'condition_contact_has_tag',
    title: 'Contato tem tag',
    group: 'Condição',
    icon: Tags,
    iconWrapClass: 'bg-amber-50 text-amber-600',
    description: 'Verifica se o contato possui uma tag.',
    createConfig: () => ({ tag: '', true_label: 'Tem tag', false_label: 'Nao tem' }),
    getSummary: (config) => config.tag ? `Valida a tag ${config.tag}.` : 'Tag alvo ainda nao definida.'
  },
  action_add_tag: {
    type: 'action_add_tag',
    title: 'Adicionar tag',
    group: 'Acao CRM',
    icon: Tags,
    iconWrapClass: 'bg-violet-50 text-violet-600',
    description: 'Aplica uma tag ao contato.',
    createConfig: () => ({ tag: '' }),
    getSummary: (config) => config.tag ? `Adiciona a tag ${config.tag}.` : 'Tag ainda nao configurada.'
  },
  action_create_task: {
    type: 'action_create_task',
    title: 'Criar tarefa',
    group: 'Acao CRM',
    icon: CircleDashed,
    iconWrapClass: 'bg-violet-50 text-violet-600',
    description: 'Cria uma tarefa operacional.',
    createConfig: () => ({ title: '', description: '', priority: 'medium' }),
    getSummary: (config) => config.title ? `Cria tarefa: ${config.title}.` : 'Tarefa ainda nao definida.'
  },
  action_move_stage: {
    type: 'action_move_stage',
    title: 'Mover estagio',
    group: 'Acao CRM',
    icon: Workflow,
    iconWrapClass: 'bg-violet-50 text-violet-600',
    description: 'Move o lead para outro estagio.',
    createConfig: () => ({ pipeline: '', stage: '' }),
    getSummary: (config) => config.stage ? `Move para ${config.stage}.` : 'Estagio de destino ainda nao definido.'
  },
  action_end_flow: {
    type: 'action_end_flow',
    title: 'Encerrar fluxo',
    group: 'Acao CRM',
    icon: XCircle,
    iconWrapClass: 'bg-violet-50 text-violet-600',
    description: 'Finaliza a automacao.',
    createConfig: () => ({ reason: '' }),
    getSummary: (config) => config.reason || 'Encerra a jornada neste ponto.'
  },
  action_delay: {
    type: 'action_delay',
    title: 'Aguardar Intervalo',
    group: 'Acao CRM',
    icon: Clock3,
    iconWrapClass: 'bg-amber-50 text-amber-600',
    description: 'Pausa a execucao por um tempo determinado.',
    createConfig: () => ({ duration: '1', unit: 'minutes' }),
    getSummary: (config) => `Aguardar ${config.duration || '1'} ${config.unit === 'hours' ? 'hora(s)' : config.unit === 'days' ? 'dia(s)' : 'minuto(s)'}.`
  }
};

const INSERT_TYPE_MAP = {
  message_text: 'send_message',
  message_question: 'ask_question',
  message_link: 'send_link',
  media_video: 'send_video',
  media_image: 'send_image',
  media_sticker: 'send_message',
  media_audio: 'send_audio',
  media_document: 'send_document',
  button_default: 'send_options',
  button_copy: 'send_copy_code',
  button_actions: 'send_action_buttons',
  integration_external: 'integration_external_call',
  integration_chatgpt: 'action_create_task',
  integration_gptmaker: 'action_create_task',
  action_limit: 'action_end_flow',
  action_record: 'action_create_task',
  action_interval: 'action_delay',
  action_condition: 'condition_contains_text',
  action_multi_condition: 'condition_equals_value',
  action_validation: 'condition_validation',
  action_move: 'action_move_stage',
  action_randomize: 'action_create_task',
  action_fake_call: 'action_create_task',
  action_contacts: 'trigger_new_contact'
};

const INSERT_LIBRARY_GROUPS = [
  {
    label: 'Mensagens',
    items: [
      { type: 'message_text', actualType: 'send_message', shortTitle: 'Texto', title: 'Texto', description: 'Mensagem simples', icon: MessageCircle },
      { type: 'message_question', actualType: 'ask_question', shortTitle: 'Pergunta', title: 'Pergunta', description: 'Pergunta e valida a resposta', icon: MessageSquareQuote },
      { type: 'message_link', actualType: 'send_link', shortTitle: 'Link', title: 'Link', description: 'Mensagem com link', icon: Link2 }
    ]
  },
  {
    label: 'Midia',
    items: [
      { type: 'media_video', actualType: 'send_video', shortTitle: 'Video', title: 'Video', description: 'Envio de video', icon: Video },
      { type: 'media_image', actualType: 'send_image', shortTitle: 'Imagem', title: 'Imagem', description: 'Envio de imagem', icon: Image },
      { type: 'media_sticker', actualType: 'send_message', shortTitle: 'Sticker', title: 'Sticker', description: 'Envio de sticker', icon: AppWindow },
      { type: 'media_audio', actualType: 'send_audio', shortTitle: 'Audio', title: 'Audio', description: 'Envio de audio', icon: Mic },
      { type: 'media_document', actualType: 'send_document', shortTitle: 'Documento', title: 'Documento', description: 'Envio de documento', icon: FileText }
    ]
  },
  {
    label: 'Botoes',
    items: [
      { type: 'button_default', actualType: 'send_options', shortTitle: 'Padrao', title: 'Padrao', description: 'Opcoes de resposta', icon: AppWindow },
      { type: 'button_copy', actualType: 'send_copy_code', shortTitle: 'Copia e Cola', title: 'Copia e Cola', description: 'Codigo copiavel', icon: FileText },
      { type: 'button_actions', actualType: 'send_action_buttons', shortTitle: 'Acoes', title: 'Acoes', description: 'Botoes com acoes', icon: Bot }
    ]
  },
  {
    label: 'Integracoes',
    items: [
      { type: 'integration_external', actualType: 'integration_external_call', shortTitle: 'Chamada externa', title: 'Chamada externa', description: 'Webhook ou API', icon: Workflow },
      { type: 'integration_chatgpt', actualType: 'action_create_task', shortTitle: 'Chat GPT 4', title: 'Chat GPT 4', description: 'Integracao IA', icon: Bot },
      { type: 'integration_gptmaker', actualType: 'action_create_task', shortTitle: 'Gpt Maker', title: 'Gpt Maker', description: 'Servico externo', icon: AppWindow }
    ]
  },
  {
    label: 'Acoes',
    items: [
      { type: 'action_limit', actualType: 'action_end_flow', shortTitle: 'Limitar execucao', title: 'Limitar execucao', description: 'Termina o fluxo', icon: XCircle },
      { type: 'action_record', actualType: 'action_create_task', shortTitle: 'Gravar Info', title: 'Gravar Info', description: 'Cria registro interno', icon: CircleDashed },
      { type: 'action_interval', actualType: 'action_delay', shortTitle: 'Aguardar', title: 'Aguardar Intervalo', description: 'Pausa a automacao', icon: Clock3 },
      { type: 'action_validation', actualType: 'condition_validation', shortTitle: 'Validacao', title: 'Validar Formato', description: 'Valida CPF, Email...', icon: CheckCircle2 },
      { type: 'action_condition', actualType: 'condition_contains_text', shortTitle: 'Condicao', title: 'Condicao', description: 'Valida regra simples', icon: GitBranch },
      { type: 'action_multi_condition', actualType: 'condition_equals_value', shortTitle: 'Multi Condi.', title: 'Multi Condi.', description: 'Comparacao exata', icon: Equal },
      { type: 'action_move', actualType: 'action_move_stage', shortTitle: 'Mover fluxo', title: 'Mover fluxo', description: 'Move de etapa', icon: Workflow },
      { type: 'action_randomize', actualType: 'action_create_task', shortTitle: 'Randomizar', title: 'Randomizar', description: 'Distribuicao futura', icon: PlusCircle },
      { type: 'action_fake_call', actualType: 'action_create_task', shortTitle: 'Fake Call', title: 'Fake Call', description: 'Acao placeholder', icon: BadgeHelp },
      { type: 'action_contacts', actualType: 'trigger_new_contact', shortTitle: 'Contatos', title: 'Contatos', description: 'Entrada por contato', icon: UserPlus }
    ]
  }
];

function isConditionType(type) {
  return [
    'condition_contains_text',
    'condition_equals_value',
    'condition_business_hours',
    'condition_contact_has_tag',
    'condition_validation',
    'action_validation'
  ].includes(type);
}

function createNode(type, indexHint = 0, position = { x: 140, y: 120 }) {
  const meta = BLOCK_DEFINITIONS[type] || BLOCK_DEFINITIONS.send_message;
  const base = String(type).replace(/[^a-z_]/gi, '').slice(0, 18) || 'node';

  return {
    id: `${base}_${Date.now()}_${indexHint}`,
    type,
    position,
    config: meta.createConfig()
  };
}

const FLOW_NODE_SLOT = {
  width: 430,
  height: 560,
  gapX: 90,
  gapY: 90
};

function positionsOverlap(left, right) {
  return !(
    left.x + FLOW_NODE_SLOT.width < right.x ||
    right.x + FLOW_NODE_SLOT.width < left.x ||
    left.y + FLOW_NODE_SLOT.height < right.y ||
    right.y + FLOW_NODE_SLOT.height < left.y
  );
}

function findOpenNodePosition(nodes, preferredPosition) {
  if (!nodes.length) return preferredPosition;

  const occupied = nodes.map((node) => node.position || { x: 140, y: 120 });
  const collides = (position) => occupied.some((taken) => positionsOverlap(position, taken));

  if (!collides(preferredPosition)) return preferredPosition;

  const stepX = FLOW_NODE_SLOT.width + FLOW_NODE_SLOT.gapX;
  const stepY = FLOW_NODE_SLOT.height + FLOW_NODE_SLOT.gapY;

  for (let column = 0; column < 10; column += 1) {
    for (let row = 0; row < 14; row += 1) {
      const candidate = {
        x: preferredPosition.x + (column * stepX),
        y: preferredPosition.y + (row * stepY)
      };

      if (!collides(candidate)) return candidate;
    }
  }

  const bottomMost = occupied.reduce((acc, position) => (
    position.y > acc.y ? position : acc
  ), occupied[0]);

  return {
    x: bottomMost.x,
    y: bottomMost.y + stepY
  };
}

function serializeFlowState(flow) {
  return JSON.stringify({
    name: flow.name,
    description: flow.description,
    category: flow.category,
    channel: flow.channel,
    status: flow.status,
    flow_json: flow.flow_json
  });
}

function getNextNodePosition(nodes, afterNodeId = null, branchKey = null) {
  if (!nodes.length) return { x: 140, y: 120 };

  const sourceNode = nodes.find((node) => node.id === afterNodeId);
  if (!sourceNode) {
    const rightMost = nodes.reduce((acc, node) => node.position.x > acc.position.x ? node : acc, nodes[0]);
    return findOpenNodePosition(nodes, {
      x: rightMost.position.x + FLOW_NODE_SLOT.width + FLOW_NODE_SLOT.gapX,
      y: rightMost.position.y
    });
  }

  const branchOffset = branchKey === 'true'
    ? { x: 340, y: -90 }
    : branchKey === 'retry'
      ? { x: FLOW_NODE_SLOT.width + FLOW_NODE_SLOT.gapX, y: 0 }
    : branchKey === 'false'
      ? { x: FLOW_NODE_SLOT.width + FLOW_NODE_SLOT.gapX, y: 140 }
      : { x: FLOW_NODE_SLOT.width + FLOW_NODE_SLOT.gapX, y: 0 };

  return findOpenNodePosition(nodes, {
    x: sourceNode.position.x + branchOffset.x,
    y: sourceNode.position.y + branchOffset.y
  });
}

function matchesEdge(edge, candidate) {
  return edge.from === candidate.from
    && edge.to === candidate.to
    && (edge.sourceHandle || null) === (candidate.sourceHandle || null)
    && (edge.targetHandle || null) === (candidate.targetHandle || null)
    && (edge.label || null) === (candidate.label || null);
}

function normalizeGenericHandle(handle) {
  if (!handle || handle === 'default' || handle === 'bottom') return 'next';
  return handle;
}

function buildEdge({ from, to, sourceHandle = null, targetHandle = null, label = null }) {
  const normalizedSourceHandle = normalizeGenericHandle(sourceHandle || label);

  return {
    from,
    to,
    sourceHandle: normalizedSourceHandle,
    targetHandle,
    label: normalizedSourceHandle
  };
}

function getNodeOptions(node) {
  return String(node.config?.options || '')
    .split('\n')
    .map((option) => option.trim())
    .filter(Boolean);
}

function describeNodeStep(node, blockDefinitions) {
  const config = node.config || {};
  const meta = blockDefinitions[node.type] || {};

  if (node.type === 'trigger_start') return 'Entrada do fluxo';
  if (node.type === 'send_message') return config.message || 'Mensagem sem texto';
  if (node.type === 'send_options') return config.message || 'Opcoes sem pergunta';
  if (node.type === 'send_link') return config.link_url || config.message || 'Link sem URL';
  if (node.type === 'send_image') return config.message || config.image_name || config.image_link || 'Imagem configurada';
  if (node.type === 'send_video') return config.message || config.video_name || config.video_link || 'Video configurado';
  if (node.type === 'send_audio') return config.message || config.audio_name || config.audio_link || 'Audio configurado';
  if (node.type === 'send_document') return config.message || config.document_name || config.document_link || 'Documento configurado';
  if (node.type === 'send_copy_code') return config.message || config.code || 'Codigo copiavel';
  if (node.type === 'send_action_buttons') return config.description || config.title || 'Botoes de acao';
  if (node.type === 'integration_external_call') return config.url || 'Chamada externa sem URL';

  return meta.getSummary?.(config) || meta.description || 'Etapa configurada';
}

function getPreferredEdge(edges, node, simulatedResponses) {
  const outgoing = edges.filter((edge) => edge.from === node.id);
  if (!outgoing.length) return null;

  if (node.type === 'send_options') {
    const selectedIndex = Number(simulatedResponses[node.id] ?? 0);
    const wantedHandle = `option_${Number.isNaN(selectedIndex) ? 1 : selectedIndex + 1}`;
    const legacyHandle = `option_${Number.isNaN(selectedIndex) ? 0 : selectedIndex}`;
    return outgoing.find((edge) => normalizeGenericHandle(edge.sourceHandle || edge.label) === wantedHandle)
      || outgoing.find((edge) => normalizeGenericHandle(edge.sourceHandle || edge.label) === legacyHandle)
      || outgoing[0];
  }

  if (node.type.startsWith('condition_')) {
    const wantedHandle = simulatedResponses[node.id] || 'true';
    return outgoing.find((edge) => (edge.sourceHandle || edge.label) === wantedHandle)
      || outgoing[0];
  }

  return outgoing.find((edge) => normalizeGenericHandle(edge.sourceHandle || edge.label) === 'next')
    || outgoing[0];
}

function simulateFlowPath(flowJson, simulatedResponses, blockDefinitions) {
  const nodes = flowJson?.nodes || [];
  const edges = flowJson?.edges || [];
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const startNode = nodes.find((node) => node.type === 'trigger_start') || nodes[0];
  const steps = [];
  const visited = new Set();
  let currentNode = startNode;

  while (currentNode && !visited.has(currentNode.id) && steps.length < 60) {
    visited.add(currentNode.id);
    const selectedEdge = getPreferredEdge(edges, currentNode, simulatedResponses);
    const selectedOptionIndex = currentNode.type === 'send_options'
      ? Number(simulatedResponses[currentNode.id] ?? 0)
      : null;

    steps.push({
      node: currentNode,
      meta: blockDefinitions[currentNode.type] || {},
      summary: describeNodeStep(currentNode, blockDefinitions),
      options: getNodeOptions(currentNode),
      selectedOptionIndex,
      nextNodeId: selectedEdge?.to || null
    });

    currentNode = selectedEdge ? nodeMap.get(selectedEdge.to) : null;
  }

  return steps;
}

function validateFlow(flow, blockDefinitions) {
  const issues = [];
  const nodes = flow.flow_json?.nodes || [];
  const edges = flow.flow_json?.edges || [];

  if (!nodes.length) {
    issues.push('O fluxo precisa ter pelo menos um bloco.');
    return issues;
  }

  if (nodes[0]?.type !== 'trigger_start') {
    issues.push('O primeiro bloco deve ser "Inicio do fluxo".');
  }

  nodes.forEach((node, index) => {
    const meta = blockDefinitions[node.type];
    if (!meta) {
      issues.push(`Bloco ${index + 1} possui tipo invalido.`);
      return;
    }

    const config = node.config || {};
    if (node.type === 'send_message' && !String(config.message || '').trim()) {
      issues.push(`"${meta.title}" precisa de uma mensagem.`);
    }
    if (node.type === 'ask_question' && !String(config.message || '').trim()) {
      issues.push(`"${meta.title}" precisa de uma pergunta.`);
    }
    if (node.type === 'send_options' && (!String(config.message || '').trim() || !String(config.options || '').trim())) {
      issues.push(`"${meta.title}" precisa de mensagem e opcoes.`);
    }
    if (node.type === 'condition_contains_text' && !String(config.value || '').trim()) {
      issues.push(`"${meta.title}" precisa do texto procurado.`);
    }
    if (node.type === 'condition_equals_value' && (!String(config.field || '').trim() || !String(config.value || '').trim())) {
      issues.push(`"${meta.title}" precisa de campo e valor esperado.`);
    }
    if (node.type === 'condition_contact_has_tag' && !String(config.tag || '').trim()) {
      issues.push(`"${meta.title}" precisa de uma tag.`);
    }
    if (node.type === 'action_add_tag' && !String(config.tag || '').trim()) {
      issues.push(`"${meta.title}" precisa da tag que sera aplicada.`);
    }
    if (node.type === 'action_create_task' && !String(config.title || '').trim()) {
      issues.push(`"${meta.title}" precisa do titulo da tarefa.`);
    }
    if (node.type === 'action_move_stage' && (!String(config.pipeline || '').trim() || !String(config.stage || '').trim())) {
      issues.push(`"${meta.title}" precisa de pipeline e estagio.`);
    }

    if (isConditionType(node.type)) {
      const outgoing = edges.filter((edge) => edge.from === node.id);
      const hasTrue = outgoing.some((edge) => (edge.sourceHandle || edge.label) === 'true');
      const hasFalse = outgoing.some((edge) => (edge.sourceHandle || edge.label) === 'false');
      const hasRetry = outgoing.some((edge) => (edge.sourceHandle || edge.label) === 'retry');
      if ((node.type === 'condition_validation' || node.type === 'action_validation') && !hasRetry) {
        issues.push(`"${meta.title}" precisa do caminho tentar novamente.`);
      }
      if (!hasTrue || !hasFalse) {
        issues.push(`"${meta.title}" precisa dos caminhos verdadeiro e falso.`);
      }
    }
  });

  return issues;
}

export default function FlowBuilderView() {
  const navigate = useNavigate();
  const { flowId } = useParams();
  const isNew = !flowId;

  const [flow, setFlow] = useState({
    id: null,
    name: 'Novo fluxo',
    description: '',
    category: 'Geral',
    channel: 'whatsapp',
    status: 'inactive',
    flow_json: createDefaultFlowJson()
  });
  const [selectedNodeId, setSelectedNodeId] = useState('start_1');
  const [loading, setLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [simulatedResponses, setSimulatedResponses] = useState({});
  const [insertMenu, setInsertMenu] = useState({
    isOpen: false,
    afterNodeId: null,
    branchKey: null
  });
  const [saveState, setSaveState] = useState('idle');
  const [hasTouchedFlow, setHasTouchedFlow] = useState(false);
  const autosaveTimerRef = useRef(null);
  const lastSavedSnapshotRef = useRef(serializeFlowState({
    name: 'Novo fluxo',
    description: '',
    category: 'Geral',
    channel: 'whatsapp',
    status: 'inactive',
    flow_json: createDefaultFlowJson()
  }));

  useEffect(() => {
    if (isNew) return;

    let isMounted = true;
    setLoading(true);

    getFlowById(flowId)
      .then((data) => {
        if (!isMounted) return;
        const normalizedFlowJson = normalizeFlowJson(data.flow_json);
        setFlow({
          ...data,
          flow_json: normalizedFlowJson
        });
        setSelectedNodeId(normalizedFlowJson.nodes?.[0]?.id || null);
        lastSavedSnapshotRef.current = serializeFlowState({
          ...data,
          flow_json: normalizedFlowJson
        });
        setSaveState('idle');
      })
      .catch((error) => {
        alert(error.message || 'Falha ao carregar fluxo.');
        navigate('/fluxos');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [flowId, isNew, navigate]);

  const validationIssues = useMemo(() => validateFlow(flow, BLOCK_DEFINITIONS), [flow]);
  const currentSnapshot = useMemo(() => serializeFlowState(flow), [flow]);
  const hasUnsavedChanges = currentSnapshot !== lastSavedSnapshotRef.current;
  const testSteps = useMemo(
    () => simulateFlowPath(flow.flow_json, simulatedResponses, BLOCK_DEFINITIONS),
    [flow.flow_json, simulatedResponses]
  );
  const latestSnapshotRef = useRef(currentSnapshot);

  useEffect(() => {
    latestSnapshotRef.current = currentSnapshot;
  }, [currentSnapshot]);

  const setFlowField = (field, value) => {
    setHasTouchedFlow(true);
    setSaveState('unsaved');
    setFlow((prev) => ({ ...prev, [field]: value }));
  };

  const setFlowGraph = (nodesUpdater, edgesUpdater) => {
    setHasTouchedFlow(true);
    setSaveState('unsaved');
    setFlow((prev) => {
      const currentNodes = prev.flow_json.nodes || [];
      const currentEdges = prev.flow_json.edges || [];
      const nextNodes = typeof nodesUpdater === 'function' ? nodesUpdater(currentNodes) : nodesUpdater;
      const nextEdges = typeof edgesUpdater === 'function'
        ? edgesUpdater(currentEdges, nextNodes, currentNodes)
        : (edgesUpdater ?? currentEdges);

      return {
        ...prev,
        flow_json: {
          nodes: nextNodes,
          edges: nextEdges
        }
      };
    });
  };

  const handleAddBlock = (type, afterNodeId = selectedNodeId, branchKey = null) => {
    const resolvedType = INSERT_TYPE_MAP[type] || type;
    let createdNodeId = null;

    setFlowGraph((nodes) => {
      const newNode = createNode(resolvedType, nodes.length + 1, getNextNodePosition(nodes, afterNodeId, branchKey));
      createdNodeId = newNode.id;
      return [...nodes, newNode];
    }, (edges) => edges);

    if (createdNodeId) setSelectedNodeId(createdNodeId);
  };

  const handleQuickAdd = (nodeId) => {
    setInsertMenu({
      isOpen: true,
      afterNodeId: nodeId || selectedNodeId,
      branchKey: null
    });
  };

  const handleAddBranch = (nodeId, branchKey) => {
    setInsertMenu({
      isOpen: true,
      afterNodeId: nodeId,
      branchKey
    });
  };

  const handleChooseInsertType = (type) => {
    handleAddBlock(type, insertMenu.afterNodeId, insertMenu.branchKey);
    setInsertMenu({
      isOpen: false,
      afterNodeId: null,
      branchKey: null
    });
  };

  const handleCloseInsertMenu = () => {
    setInsertMenu({
      isOpen: false,
      afterNodeId: null,
      branchKey: null
    });
  };

  const handleDuplicateNode = (nodeId) => {
    setFlowGraph((nodes) => {
      const currentNode = nodes.find((node) => node.id === nodeId);
      if (!currentNode) return nodes;

      const clone = {
        ...currentNode,
        id: `${currentNode.type}_${Date.now()}_${nodes.length + 1}`,
        position: findOpenNodePosition(nodes, {
          x: currentNode.position.x + FLOW_NODE_SLOT.width + FLOW_NODE_SLOT.gapX,
          y: currentNode.position.y
        }),
        config: { ...(currentNode.config || {}) }
      };

      setSelectedNodeId(clone.id);
      return [...nodes, clone];
    }, (edges) => edges);
  };

  const handleRemoveNode = (nodeId) => {
    setFlowGraph((nodes) => {
      const nextNodes = nodes.filter((node) => node.id !== nodeId);
      if (!nextNodes.length) return nodes;

      if (selectedNodeId === nodeId) {
        setSelectedNodeId(nextNodes[0]?.id || null);
      }

      return nextNodes;
    }, (edges) => {
      const incoming = edges.filter((edge) => edge.to === nodeId);
      const outgoing = edges.filter((edge) => edge.from === nodeId);
      const remaining = edges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId);

      if (incoming.length === 1 && outgoing.length === 1) {
        remaining.push(buildEdge({
          from: incoming[0].from,
          to: outgoing[0].to,
          sourceHandle: incoming[0].sourceHandle || incoming[0].label || null,
          label: incoming[0].sourceHandle || incoming[0].label || null
        }));
      }

      return remaining;
    });
  };

  const handleUpdateNodeConfig = (nodeId, partialConfig) => {
    setFlowGraph(
      (nodes) => nodes.map((node) => (
        node.id === nodeId
          ? { ...node, config: { ...(node.config || {}), ...partialConfig } }
          : node
      )),
      (edges) => edges
    );
  };

  const handleMoveNode = (nodeId, position) => {
    setFlowGraph(
      (nodes) => nodes.map((node) => (
        node.id === nodeId
          ? { ...node, position }
          : node
      )),
      (edges) => edges
    );
  };

  const handleConnectNodes = (edgeCandidate) => {
    if (!edgeCandidate?.from || !edgeCandidate?.to || edgeCandidate.from === edgeCandidate.to) return;

    setFlowGraph(
      (nodes) => nodes,
      (edges) => {
        const branchHandle = normalizeGenericHandle(edgeCandidate.sourceHandle || edgeCandidate.label);
        const withoutSameBranch = edges.filter((edge) => !(
          edge.from === edgeCandidate.from
          && normalizeGenericHandle(edge.sourceHandle || edge.label) === branchHandle
        ));

        const nextEdge = buildEdge({
          from: edgeCandidate.from,
          to: edgeCandidate.to,
          sourceHandle: branchHandle,
          targetHandle: edgeCandidate.targetHandle || null,
          label: branchHandle
        });

        return [...withoutSameBranch, nextEdge];
      }
    );
  };

  const handleDeleteEdges = (edgeCandidates) => {
    setFlowGraph(
      (nodes) => nodes,
      (edges) => edges.filter((edge) => !edgeCandidates.some((candidate) => matchesEdge(edge, candidate)))
    );
  };

  const persistFlow = async ({ silent = false } = {}) => {
    const flowToSave = flow;
    const snapshotAtStart = serializeFlowState(flowToSave);

    try {
      setIsSaving(true);
      setSaveState('saving');

      if (flowToSave.status === 'active' && validationIssues.length) {
        throw new Error('Resolva os alertas do fluxo antes de ativa-lo.');
      }

      const saved = await saveFlow(flowToSave);
      const savedSnapshot = serializeFlowState(saved);
      const isStillCurrent = latestSnapshotRef.current === snapshotAtStart;

      if (isStillCurrent) {
        setFlow(saved);
        setSelectedNodeId((current) => current || saved.flow_json.nodes?.[0]?.id || null);
        lastSavedSnapshotRef.current = savedSnapshot;
        latestSnapshotRef.current = savedSnapshot;
        setSaveState('saved');
      } else {
        setSaveState('unsaved');
      }

      await createFlowLog(saved.id, 'flow_saved', {
        node_count: saved.flow_json.nodes.length,
        edge_count: saved.flow_json.edges.length
      });
      if (isNew) {
        navigate(`/fluxos/${saved.id}`, { replace: true });
      }
      return saved;
    } catch (error) {
      setSaveState('error');
      if (!silent) alert(error.message || 'Falha ao salvar fluxo.');
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    await persistFlow({ silent: false });
  };

  useEffect(() => {
    if (!hasTouchedFlow || !hasUnsavedChanges || loading || isSaving) return;

    window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(() => {
      persistFlow({ silent: true }).catch(() => {});
    }, 1200);

    return () => window.clearTimeout(autosaveTimerRef.current);
  }, [hasTouchedFlow, hasUnsavedChanges, loading, isSaving, currentSnapshot]);

  useEffect(() => {
    if (!hasUnsavedChanges) return undefined;

    const handler = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-8 py-8">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-8 py-8">
      <FlowToolbar
        flow={flow}
        onBack={() => navigate('/fluxos')}
        onChange={setFlowField}
        onSave={handleSave}
        onTest={() => setShowTestModal(true)}
        isSaving={isSaving}
        saveState={saveState}
        validationCount={validationIssues.length}
      />

      <div className="grid gap-6">
        <FlowCanvas
          nodes={flow.flow_json.nodes}
          edges={flow.flow_json.edges}
          selectedNodeId={selectedNodeId}
          blockMap={BLOCK_DEFINITIONS}
          libraryGroups={INSERT_LIBRARY_GROUPS}
          onSelectNode={setSelectedNodeId}
          onUpdateNodeConfig={handleUpdateNodeConfig}
          onDuplicateNode={handleDuplicateNode}
          onRemoveNode={handleRemoveNode}
          onQuickAdd={handleQuickAdd}
          onAddBranch={handleAddBranch}
          onMoveNode={handleMoveNode}
          onConnectNodes={handleConnectNodes}
          onDeleteEdges={handleDeleteEdges}
          insertMenu={insertMenu}
          onChooseInsertType={handleChooseInsertType}
          onCloseInsertMenu={handleCloseInsertMenu}
        />
      </div>

      <Modal
        isOpen={showTestModal}
        onClose={() => setShowTestModal(false)}
        title="Teste do fluxo"
        className="max-w-4xl"
      >
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Fluxo</p>
              <p className="mt-2 text-lg font-black text-slate-900">{flow.name}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Blocos</p>
              <p className="mt-2 text-lg font-black text-slate-900">{flow.flow_json.nodes.length}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Canal</p>
              <p className="mt-2 text-lg font-black uppercase text-slate-900">{flow.channel}</p>
            </div>
          </div>

          <div className="rounded-[2rem] border border-cyan-100 bg-cyan-50/60 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-700">Simulador pratico</p>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">
              Escolha as respostas dos blocos de opcoes e veja qual caminho o contato vai seguir.
            </p>
          </div>

          {validationIssues.length > 0 && (
            <div className="rounded-[2rem] border border-amber-200 bg-amber-50/80 p-5">
              <p className="mb-3 text-[10px] font-black uppercase tracking-[0.22em] text-amber-700">Alertas de validacao</p>
              <div className="space-y-2">
                {validationIssues.map((issue) => (
                  <div key={issue} className="text-sm font-bold text-amber-900">
                    - {issue}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-4">
            {testSteps.map((step, index) => {
              const StepIcon = step.meta.icon || CircleDashed;
              const selectedOption = step.options[step.selectedOptionIndex] || step.options[0] || null;

              return (
                <div key={step.node.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <StepIcon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase text-slate-500">
                          Passo {index + 1}
                        </span>
                        <h4 className="text-base font-black text-slate-900">{step.meta.title || step.node.type}</h4>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-slate-600">
                        {step.summary}
                      </p>

                      {step.node.type === 'send_options' && step.options.length > 0 && (
                        <div className="mt-4">
                          <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                            Resposta simulada
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {step.options.map((option, optionIndex) => (
                              <button
                                key={`${step.node.id}-${option}`}
                                type="button"
                                onClick={() => setSimulatedResponses((current) => ({
                                  ...current,
                                  [step.node.id]: optionIndex
                                }))}
                                className={cn(
                                  'rounded-full border px-4 py-2 text-sm font-black transition-all',
                                  Number(simulatedResponses[step.node.id] ?? 0) === optionIndex
                                    ? 'border-primary bg-primary text-white shadow-lg shadow-primary/20'
                                    : 'border-slate-200 bg-white text-slate-600 hover:border-primary/30 hover:text-primary'
                                )}
                              >
                                {option}
                              </button>
                            ))}
                          </div>
                          {selectedOption && (
                            <p className="mt-3 text-xs font-semibold text-slate-500">
                              Caminho escolhido: {selectedOption}
                            </p>
                          )}
                        </div>
                      )}

                      {!step.nextNodeId && (
                        <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-500">
                          Fim deste caminho. Nenhum proximo bloco conectado.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Modal>
    </div>
  );
}
