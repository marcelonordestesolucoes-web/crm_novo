import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://taaxcvtsdpkatopavsto.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhYXhjdnRzZHBrYXRvcGF2c3RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2ODkwOTMsImV4cCI6MjA5MTI2NTA5M30.9oop0xMgHbqOwNXHwTbeC-AJxEqraWz7DUUTMqlLfKk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runFix() {
  console.log('--- Iniciando fix do Pipeline ---');
  
  // 1. Pega os pipelines
  const { data: pipelines, error: pError } = await supabase.from('pipelines').select('*');
  if (pError || !pipelines || pipelines.length === 0) {
    console.error('Nenhum pipeline encontrado!');
    return;
  }
  
  const pipelineId = pipelines[0].id;
  const orgId = pipelines[0].org_id;
  console.log(`Pipeline usado: ${pipelines[0].name} (ID: ${pipelineId}) - Org: ${orgId}`);

  // 2. Verifica as etapas (stages)
  const { data: stages } = await supabase.from('pipeline_stages').select('*').eq('pipeline_id', pipelineId);
  
  let currentStages = stages || [];
  
  if (currentStages.length === 0) {
    console.log('Criando etapas padrão...');
    const defaultStages = [
      { id: crypto.randomUUID(), label: 'LEAD', color: 'bg-slate-500', sort_order: 10, pipeline_id: pipelineId },
      { id: crypto.randomUUID(), label: 'QUALIFICADO', color: 'bg-primary', sort_order: 20, pipeline_id: pipelineId },
      { id: crypto.randomUUID(), label: 'PROPOSTA', color: 'bg-indigo-500', sort_order: 30, pipeline_id: pipelineId },
      { id: crypto.randomUUID(), label: 'NEGOCIAÇÃO', color: 'bg-amber-500', sort_order: 40, pipeline_id: pipelineId },
      { id: crypto.randomUUID(), label: 'FECHADO', color: 'bg-emerald-500', sort_order: 50, pipeline_id: pipelineId }
    ];
    
    // Inserir limpo
    const { data: insertedStages, error: sError } = await supabase
      .from('pipeline_stages')
      .insert(defaultStages)
      .select();
      
    if (sError) {
      console.error('Erro ao inserir etapas:', sError);
      return;
    }
    currentStages = insertedStages;
  }
  
  console.log(`Etapas ativas: ${currentStages.length}`);
  const leadStageId = currentStages.find(s => s.label === 'LEAD')?.id || currentStages[0]?.id;
  console.log(`ID da etapa LEAD: ${leadStageId}`);

  // 3. Pega os deals para realocar os que estão órfãos
  // Como estamos testando fora, pode não achar por RLS.
  console.log("Para sincronizar por RLS, vamos omitir deals aqui (já será feito pelo front).");

  console.log('--- Fix Concluído ---');
}

runFix();
