// ============================================================
//  STITCH CRM — ÚNICA FONTE DE VERDADE (config.js)
//  Para alterar qualquer rótulo, cor ou comportamento do sistema,
//  faça a mudança aqui. O restante da aplicação se adapta.
// ============================================================

// --- LOCALIZAÇÃO ---
export const LOCALE = 'pt-BR';
export const CURRENCY = 'BRL';
export const CURRENCY_SYMBOL = 'R$';

export const formatCurrency = (value) =>
  new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: CURRENCY,
    maximumFractionDigits: 0,
  }).format(value);

export const formatDate = (date) =>
  new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium' }).format(new Date(date));

// --- NAVEGAÇÃO PRINCIPAL ---
export const NAV_ITEMS = [
  { id: 'home',      label: 'Início',    icon: 'home',       path: '/' },
  { id: 'pipeline',  label: 'Pipeline',  icon: 'analytics',  path: '/pipeline' },
  { id: 'conversas', label: 'Conversas', icon: 'chat',       path: '/conversas' },
  { id: 'empresas',  label: 'Empresas',  icon: 'business',   path: '/empresas' },
  { id: 'contatos',  label: 'Contatos',  icon: 'contacts',   path: '/contatos' },
  { id: 'tarefas',   label: 'Tarefas',   icon: 'task_alt',   path: '/tarefas' },
  { id: 'campanhas', label: 'Campanhas', icon: 'campaign',   path: '/campanhas' },
  { id: 'fluxos',    label: 'Fluxos',    icon: 'account_tree', path: '/fluxos' },
  { id: 'analytics', label: 'Analytics', icon: 'monitoring', path: '/analytics' },
];

// --- ESTÁGIOS DO PIPELINE ---
// Para adicionar/renomear um estágio, altere apenas este array.
export const PIPELINE_STAGES = [
  { id: 'lead',         label: 'Lead',        color: 'bg-slate-500' },
  { id: 'qualified',    label: 'Qualificado', color: 'bg-blue-500' },
  { id: 'proposal',     label: 'Proposta',    color: 'bg-amber-500' },
  { id: 'negotiation',  label: 'Negociando',  color: 'bg-violet-500' },
  { id: 'lost',         label: 'Perdido',     color: 'bg-red-500' },
  { id: 'won',          label: 'Ganho',       color: 'bg-emerald-500' },
];

// --- STATUS DE NEGÓCIOS ---
// Controla cores, rótulos e ícones em todos os cards de Deal.
export const DEAL_STATUS = {
  new: {
    label: 'Nova Oportunidade',
    badgeClass: 'bg-primary-fixed text-on-primary-fixed',
    dotClass: 'bg-primary',
  },
  hot: {
    label: 'Estratégico',
    badgeClass: 'bg-emerald-100 text-emerald-800',
    dotClass: 'bg-emerald-500',
    actionIcon: 'local_fire_department',
    actionLabel: '90% PROBABILIDADE',
    actionClass: 'text-primary',
  },
  'at-risk': {
    label: 'Em Risco',
    badgeClass: 'bg-error-container text-error',
    dotClass: 'bg-error',
    actionIcon: 'warning',
    actionLabel: 'EM RISCO',
    actionClass: 'text-error',
  },
};

// --- PRIORIDADES DE TAREFAS ---
export const TASK_PRIORITY = {
  high:   { label: 'Alta Prioridade',   badgeClass: 'bg-error-container text-error' },
  medium: { label: 'Média Prioridade',  badgeClass: 'bg-secondary-fixed text-on-secondary-fixed' },
  low:    { label: 'Baixa Prioridade',  badgeClass: 'bg-surface-container text-on-surface-variant' },
};

// --- STATUS DE TAREFAS ---
export const TASK_STATUS = {
  pending:   { label: 'Pendente',   circleClass: 'border-slate-200 bg-slate-50' },
  completed: { label: 'Concluída',  circleClass: 'bg-emerald-500 border-emerald-500 text-white' },
  overdue:   { label: 'Atrasada',   circleClass: 'border-error bg-error/5' },
};

// --- HEALTH SCORE ---
export const getHealthScoreStyle = (score) =>
  score > 80
    ? { text: 'text-emerald-600', fill: 'text-emerald-600' }
    : { text: 'text-amber-600',   fill: 'text-amber-600' };

// --- ESTÁGIOS DE EMPRESA ---
export const COMPANY_STAGE = {
  'Cliente Ativo':     { badgeClass: 'bg-emerald-100 text-emerald-800' },
  'Negociação':        { badgeClass: 'bg-primary-fixed text-on-primary-fixed' },
  'Contrato Assinado': { badgeClass: 'bg-tertiary-fixed text-on-tertiary-fixed' },
};

// --- ROTAS DA APLICAÇÃO ---
export const ROUTES = {
  HOME:      '/',
  PIPELINE:  '/pipeline',
  EMPRESAS:  '/empresas',
  CONTATOS:  '/contatos',
  TAREFAS:   '/tarefas',
  CAMPANHAS: '/campanhas',
  FLUXOS:    '/fluxos',
  ANALYTICS: '/analytics',
  CONFIGURACOES: '/configuracoes',
};
