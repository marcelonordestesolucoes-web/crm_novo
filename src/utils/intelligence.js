import { calculateDealRisk } from './dealRisk';

/**
 * Radar de Fechamento: Calcula a probabilidade (0-100) de um deal fechar.
 */
export const calculateClosingScore = (deal, notes = []) => {
  const lastUpdateStr = deal.updatedAt || deal.createdAt;
  const lastUpdate = lastUpdateStr ? new Date(lastUpdateStr) : new Date();
  const daysSinceUpdate = (new Date() - lastUpdate) / (1000 * 60 * 60 * 24);
  const riskResult = calculateDealRisk(deal.qualification || {});
  const risk = riskResult?.risk || 'low';

  let score = 50; // Base score
  
  // Weights por estágio (Case-Insensitive & Dynamic)
  const lbl = (deal.stageLabel || '').toLowerCase();
  if (lbl.includes('proposta') || lbl.includes('proposal')) score += 15;
  else if (lbl.includes('negoc') || lbl.includes('negotiation')) score += 30;
  else if (lbl.includes('fechamento') || lbl.includes('closing')) score += 40;

  // Weights por risco (Baseado no Questionário)
  if (risk === 'high') score -= 35;
  else if (risk === 'medium') score -= 10;
  else if (risk === 'low') score += 15;

  // Weights por inatividade
  if (daysSinceUpdate > 5) score -= 20;
  else if (daysSinceUpdate > 3) score -= 10;

  // Sentiment Analysis das notas
  notes.forEach(n => {
    const nt = n.toLowerCase();
    if (nt.includes('fechar') || nt.includes('aprovado') || nt.includes('ok')) score += 20;
    if (nt.includes('concorrente') || nt.includes('talvez') || nt.includes('pensar')) score -= 15;
  });

  score = Math.max(0, Math.min(100, score));

  let level = 'medium';
  let label = 'Chance média';
  let icon = 'trending_up';

  if (score > 70) {
    level = 'high';
    label = 'Alta chance';
    icon = 'rocket_launch';
  } else if (score < 40) {
    level = 'low';
    label = 'Baixa chance';
    icon = 'warning';
  }

  return { score, label, level, icon };
};

/**
 * Forecast IA: Calcula o valor ponderado de receita futura e gap em relação a meta.
 */
export const calculateForecastMetrics = (deals, latestNotes = {}, orgGoalAmount = 0) => {
  let totalPipeline = 0;
  let totalForecast = 0;
  let closedWonValue = 0;
  let totalClosedValue = 0;

  let eligibleDealsCount = 0;
  let closedWonCount = 0;

  deals.forEach(deal => {
    const value = deal.value || 0;
    const status = deal.status || 'open';
    const stageLabel = (deal.stageLabel || '').toUpperCase();
    const isLead = stageLabel.includes('LEAD');

    if (status === 'open') {
      totalPipeline += value;
      // FIX 3: Excluir leads do forecast — consistência com Dashboard
      if (!isLead) {
        const notes = latestNotes[deal.id] || [];
        const closing = calculateClosingScore(deal, notes);
        totalForecast += value * (closing.score / 100);
        eligibleDealsCount++;
      }
    } else if (status === 'won') {
      closedWonCount++;
      closedWonValue += value;
      totalClosedValue += value;
      eligibleDealsCount++; // Ganhos sempre contam
    } else if (status === 'lost') {
      totalClosedValue += value;
      if (!isLead) eligibleDealsCount++; // Só conta perda se chegou a ser qualificado
    }
  });

  // FIX 4: Calcular daysRemaining aqui para uso no OracleInsight (dailyVelocity)
  const today = new Date();
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const daysRemaining = Math.max(1, Math.ceil((endOfMonth - today) / (1000 * 60 * 60 * 24)));

  const gap = Math.max(0, orgGoalAmount - totalForecast);
  const progress = orgGoalAmount > 0 ? (totalForecast / orgGoalAmount) : 0;
  const conversionRate = eligibleDealsCount > 0 ? (closedWonCount / eligibleDealsCount) * 100 : 0;

  return {
    totalPipeline,
    totalForecast,
    gap,
    progress,
    meta: orgGoalAmount,
    conversionRate,
    daysRemaining, // FIX 4: Exposto para cálculo de velocidade diária
  };
};
