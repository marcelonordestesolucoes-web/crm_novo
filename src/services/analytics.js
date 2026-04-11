import { supabase } from '@/lib/supabase';

/**
 * Busca estatísticas agregadas do Pipeline para o Dashboard de Analytics.
 */
export async function getPipelineAnalytics() {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;

  // Busca org_id
  const { data: membership } = await supabase
    .from('memberships')
    .select('org_id')
    .eq('user_id', userId)
    .limit(1);
  const orgId = membership?.[0]?.org_id;

  // Busca todos os deals da organização
  const { data: deals, error } = await supabase
    .from('deals')
    .select('*')
    .eq('org_id', orgId);

  if (error) throw error;

  const totalValue = deals.reduce((sum, d) => sum + Number(d.value || 0), 0);
  const wonDeals = deals.filter(d => d.stage === 'won' || d.stage === 'closed_won');
  const wonValue = wonDeals.reduce((sum, d) => sum + Number(d.value || 0), 0);
  
  const ticketMedio = wonDeals.length > 0 ? wonValue / wonDeals.length : 0;
  const conversionRate = deals.length > 0 ? (wonDeals.length / deals.length) * 100 : 0;

  // Distribuição por Estágios para o Gráfico
  const stageDistribution = deals.reduce((acc, d) => {
    acc[d.stage] = (acc[d.stage] || 0) + Number(d.value || 0);
    return acc;
  }, {});

  return {
    totalValue,
    wonValue,
    ticketMedio,
    conversionRate,
    count: deals.length,
    stageDistribution
  };
}
