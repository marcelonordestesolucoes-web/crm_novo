import { supabase } from '@/lib/supabase';
import { getUserPermissions } from './auth';

export const FLOW_STATUSES = {
  ACTIVE: 'active',
  INACTIVE: 'inactive'
};

export const FLOW_CHANNELS = {
  WHATSAPP: 'whatsapp',
  EMAIL: 'email',
  CRM: 'crm'
};

export const FLOW_CATEGORIES = [
  'Atendimento',
  'Qualificacao',
  'Follow-up',
  'Pipeline',
  'Reengajamento',
  'Geral'
];

const FLOW_SELECT = `
  id,
  org_id,
  name,
  description,
  category,
  channel,
  status,
  flow_json,
  created_by,
  created_at,
  updated_at
`;

export function createDefaultFlowJson() {
  return {
    nodes: [
      {
        id: 'start_1',
        type: 'trigger_start',
        position: { x: 140, y: 120 },
        config: {}
      }
    ],
    edges: []
  };
}

export function normalizeFlowJson(flowJson) {
  const raw = flowJson && typeof flowJson === 'object' ? flowJson : createDefaultFlowJson();
  const nodes = Array.isArray(raw.nodes) ? raw.nodes : [];
  const inputEdges = Array.isArray(raw.edges) ? raw.edges : [];
  const edges = inputEdges.length
    ? inputEdges
    : nodes.slice(0, -1).map((node, index) => ({
        from: node.id || `node_${index + 1}`,
        to: nodes[index + 1]?.id || `node_${index + 2}`,
        label: null
      }));

  return {
    nodes: nodes.map((node, index) => ({
      id: node.id || `node_${index + 1}`,
      type: node.type || 'send_message',
      position: {
        x: Number.isFinite(node?.position?.x) ? node.position.x : 140 + (index * 260),
        y: Number.isFinite(node?.position?.y) ? node.position.y : 120
      },
      config: node.config || {}
    })),
    edges: edges
      .filter((edge) => edge?.from && edge?.to)
      .map((edge) => ({
        from: edge.from,
        to: edge.to,
        label: edge.label || null,
        sourceHandle: edge.sourceHandle || edge.label || null,
        targetHandle: edge.targetHandle || null
      }))
  };
}

function buildPayload(flow) {
  return {
    name: String(flow.name || '').trim(),
    description: flow.description?.trim() || null,
    category: flow.category || 'Geral',
    channel: flow.channel || FLOW_CHANNELS.WHATSAPP,
    status: flow.status || FLOW_STATUSES.INACTIVE,
    flow_json: normalizeFlowJson(flow.flow_json || createDefaultFlowJson()),
    updated_at: new Date().toISOString()
  };
}

export async function getFlows() {
  const { orgId } = await getUserPermissions();
  if (!orgId) throw new Error('Usuario sem organizacao.');

  const { data, error } = await supabase
    .from('automation_flows')
    .select(FLOW_SELECT)
    .eq('org_id', orgId)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data || []).map((flow) => ({
    ...flow,
    flow_json: normalizeFlowJson(flow.flow_json)
  }));
}

export async function getFlowById(flowId) {
  if (!flowId) throw new Error('ID do fluxo obrigatorio.');

  const { orgId } = await getUserPermissions();
  if (!orgId) throw new Error('Usuario sem organizacao.');

  const { data, error } = await supabase
    .from('automation_flows')
    .select(FLOW_SELECT)
    .eq('org_id', orgId)
    .eq('id', flowId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Fluxo nao encontrado.');

  return {
    ...data,
    flow_json: normalizeFlowJson(data.flow_json)
  };
}

export async function saveFlow(flow) {
  const { orgId, userId } = await getUserPermissions();
  if (!orgId) throw new Error('Usuario sem organizacao.');
  if (!String(flow?.name || '').trim()) throw new Error('Nome do fluxo e obrigatorio.');

  const payload = buildPayload(flow);

  if (flow.id) {
    const { data, error } = await supabase
      .from('automation_flows')
      .update(payload)
      .eq('org_id', orgId)
      .eq('id', flow.id)
      .select(FLOW_SELECT)
      .single();

    if (error) throw error;
    return {
      ...data,
      flow_json: normalizeFlowJson(data.flow_json)
    };
  }

  const { data, error } = await supabase
    .from('automation_flows')
    .insert({
      ...payload,
      org_id: orgId,
      created_by: userId
    })
    .select(FLOW_SELECT)
    .single();

  if (error) throw error;
  return {
    ...data,
    flow_json: normalizeFlowJson(data.flow_json)
  };
}

export async function deleteFlow(flowId) {
  if (!flowId) throw new Error('ID do fluxo obrigatorio.');

  const { orgId } = await getUserPermissions();
  if (!orgId) throw new Error('Usuario sem organizacao.');

  const { error } = await supabase
    .from('automation_flows')
    .delete()
    .eq('org_id', orgId)
    .eq('id', flowId);

  if (error) throw error;
  return true;
}

export async function createFlowLog(flowId, event, payload = {}, level = 'info') {
  if (!flowId || !event) return null;

  const { error } = await supabase
    .from('automation_flow_logs')
    .insert({
      flow_id: flowId,
      event,
      payload,
      level
    });

  if (error) throw error;
  return true;
}
