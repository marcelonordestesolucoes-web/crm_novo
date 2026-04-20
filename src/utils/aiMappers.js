/**
 * STITCH CRM — Elite Strategic Mappings
 * Traduz termos técnicos da IA para linguagem de vendas (Seller-Facing).
 */

export const STRATEGY_MAPPING = {
  'reframe_priority': 'Urgência com Valor',
  'urgency_with_value': 'Urgência com Valor',
  'reduction_of_risk': 'Redução de Risco',
  'risk_mitigation': 'Redução de Risco',
  'objection_handling': 'Quebra de Objeção',
  'negotiation_strategy': 'Poder de Negociação',
  'closing_push': 'Impulso de Fechamento',
  'discovery_depth': 'Aprofundamento de Descoberta',
  'followup_strategic': 'Follow-up Estratégico',
  'send_urgency_trigger': 'Gatilho de Urgência',
  'reframe_value': 'Reenquadramento de Valor'
};

export const IMPACT_LEVELS = {
  POSITIVE: {
    label: 'Alta chance de fechamento',
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    icon: 'trending_up'
  },
  NEUTRAL: {
    label: 'Progresso estável',
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
    icon: 'trending_flat'
  },
  NEGATIVE: {
    label: 'Risco de perda detectado',
    color: 'text-error',
    bg: 'bg-error/10',
    icon: 'trending_down'
  }
};

export function getImpactTheme(score) {
  if (score >= 0.3) return IMPACT_LEVELS.POSITIVE;
  if (score <= -0.15) return IMPACT_LEVELS.NEGATIVE;
  return IMPACT_LEVELS.NEUTRAL;
}

export function translateStrategy(strategy) {
  return STRATEGY_MAPPING[strategy] || 'Ação Consultiva';
}
