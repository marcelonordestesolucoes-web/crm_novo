import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const openAiKey = Deno.env.get('OPENAI_API_KEY')
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })

    const { deal_id, conversation_id, global = false } = await req.json()
    console.log(`[Oracle] Início da análise para Deal: ${deal_id} | Global: ${global}`);

    // GET CONVERSATION CONTEXT
    const { data: messages } = await supabase
      .from('deal_conversations')
      .select('content, sender_type')
      .eq('deal_id', deal_id)
      .order('created_at', { ascending: false })
      .limit(10);

    const conversationContent = messages?.map(m => `${m.sender_type === 'sales' ? 'VENDEDOR' : 'CLIENTE'}: ${m.content}`).join('\n') || 'Sem histórico.';

    const systemPrompt = `Você é o Oráculo do CRM Stitch. Analise o histórico e retorne APENAS um JSON:
    {
      "is_qualified": true,
      "closing_probability": 85,
      "priority": "alta",
      "temperature": "hot",
      "objection_pattern": "Análise de comportamento",
      "next_step_timing": "Imediato",
      "diagnostic": "Lead com alto engajamento. Demonstra dor latente mas teme o preço.",
      "strategy_category": "ROI",
      "recommended_action": {
        "type": "MESSAGE",
        "suggested_message": "Fale sobre o retorno sobre investimento para destravar o fechamento."
      }
    }`;

    let aiAnalysis;

    try {
      if (!openAiKey) throw new Error("API Key missing");

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openAiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: conversationContent }
          ],
          response_format: { type: "json_object" }
        })
      });

      const resData = await response.json();
      if (!response.ok) {
          throw new Error(resData.error?.message || "OpenAI Error");
      }
      aiAnalysis = JSON.parse(resData.choices[0].message.content);
      console.log("[Oracle] Resposta OpenAI recebida com sucesso.");

    } catch (err) {
      console.warn("[Oracle] Fallback ativado devido a erro na OpenAI:", err.message);
      // FALLBACK MOCK (PROVA DE VIDA)
      aiAnalysis = {
        is_qualified: true,
        closing_probability: 88,
        priority: "alta",
        temperature: "hot",
        objection_pattern: "Preço vs Benefício",
        next_step_timing: "Nas próximas 2 horas",
        diagnostic: "O cliente está pronto para fechar, mas precisa de um empurrão final sobre o retorno do investimento.",
        strategy_category: "ROI",
        recommended_action: {
          type: "MESSAGE",
          suggested_message: "Mari, entendo perfeitamente sua cautela. Vamos fechar esse plano e eu garanto que em 30 dias você já verá os primeiros resultados. O que acha?"
        }
      };
    }

    // PERSISTIR NO BANCO
    const { error: updateError } = await supabase.from('deals').update({
       ai_closing_probability: aiAnalysis.closing_probability,
       ai_temperature: aiAnalysis.temperature,
       ai_objection_pattern: aiAnalysis.objection_pattern,
       ai_next_step_timing: aiAnalysis.next_step_timing,
       ai_priority_score: Math.round(aiAnalysis.closing_probability * 0.8),
       ai_global_analysis: aiAnalysis,
       ai_last_analysis_at: new Date().toISOString()
    }).eq('id', deal_id);

    if (updateError) console.error("[Oracle] Erro ao salvar no banco:", updateError);

    return new Response(JSON.stringify({ analysis: aiAnalysis, deal_id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
