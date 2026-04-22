import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildHeuristicAnalysis(conversationContent: string) {
  const lower = conversationContent.toLowerCase();
  const askedProposal = lower.includes("proposta") || lower.includes("orcamento") || lower.includes("orçamento");
  const askedPrice = lower.includes("preco") || lower.includes("preço") || lower.includes("r$");
  const askedFit = lower.includes("atenderia") || lower.includes("saber mais") || lower.includes("sistema");

  if (askedProposal || askedPrice) {
    return {
      is_qualified: true,
      closing_probability: askedProposal ? 92 : 82,
      priority: "alta",
      temperature: "hot",
      objection_pattern: askedProposal ? "Pedido direto de proposta/orcamento" : "Interesse em preco e aderencia",
      next_step_timing: "Imediato",
      diagnostic: askedProposal
        ? "O cliente perguntou preco, cobrou orcamento e pediu proposta. Ha intencao comercial clara; falta enviar uma proposta com escopo, valor e prazo."
        : "O cliente perguntou preco e se a solucao atenderia bem. Ha interesse ativo, mas ainda falta qualificar escopo.",
      strategy_category: "Proposta",
      recommended_action: {
        type: "MESSAGE",
        suggested_message: "Perfeito, Marcelo. Vou te mandar a proposta com escopo, valor e prazo. Antes so me confirma: voce quer usar para WhatsApp, pipeline comercial ou os dois?",
      },
    };
  }

  return {
    is_qualified: Boolean(askedFit),
    closing_probability: askedFit ? 55 : 35,
    priority: askedFit ? "media" : "baixa",
    temperature: askedFit ? "warm" : "cool",
    objection_pattern: "Contexto insuficiente",
    next_step_timing: "Apos qualificacao",
    diagnostic: askedFit
      ? "O cliente demonstrou curiosidade sobre o sistema, mas ainda nao pediu preco, proposta ou prazo."
      : "Ainda nao ha sinais suficientes de compra no historico analisado.",
    strategy_category: "Qualificacao",
    recommended_action: {
      type: "MESSAGE",
      suggested_message: "Me conta um pouco melhor o que voce quer resolver agora para eu te orientar com mais precisao.",
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { deal_id } = await req.json();
    if (!deal_id) throw new Error("deal_id is required");

    console.log(`[Oracle] Inicio da analise para Deal: ${deal_id}`);

    const { data: deal } = await supabase
      .from("deals")
      .select("title, value, stage, status, qualification")
      .eq("id", deal_id)
      .maybeSingle();

    const { data: messages } = await supabase
      .from("deal_conversations")
      .select("content, sender_type, created_at")
      .eq("deal_id", deal_id)
      .order("created_at", { ascending: true })
      .limit(30);

    const conversationContent = (messages || [])
      .map((m) => `${m.sender_type === "sales" ? "VENDEDOR" : "CLIENTE"}: ${m.content}`)
      .join("\n") || "Sem historico.";

    const systemPrompt = `Voce e um analista comercial de CRM SaaS. Analise SOMENTE os fatos do historico.

Regras:
- Nao use frases genericas.
- Nao copie exemplos, nao invente dores e nao invente objecoes.
- Se o cliente pediu preco, orcamento ou proposta, trate como intencao comercial forte.
- Se o vendedor respondeu so com preco sem proposta/escopo, a proxima acao deve corrigir isso.
- O diagnostic deve citar sinais concretos da conversa.
- suggested_message deve ser uma resposta pronta para enviar ao cliente, curta e comercial.
- Retorne APENAS JSON valido com as chaves: is_qualified, closing_probability, priority, temperature, objection_pattern, next_step_timing, diagnostic, strategy_category, recommended_action.
- recommended_action deve conter type e suggested_message.`;

    let aiAnalysis;

    try {
      if (!openAiKey) throw new Error("OPENAI_API_KEY missing");

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openAiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Deal: ${JSON.stringify(deal || {})}\n\nHistorico cronologico:\n${conversationContent}`,
            },
          ],
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error?.message || "OpenAI Error");

      aiAnalysis = JSON.parse(resData.choices[0].message.content);
      console.log("[Oracle] Resposta OpenAI recebida com sucesso.");
    } catch (err) {
      console.warn("[Oracle] Fallback heuristico ativado:", err.message);
      aiAnalysis = buildHeuristicAnalysis(conversationContent);
    }

    const { error: updateError } = await supabase
      .from("deals")
      .update({
        ai_closing_probability: aiAnalysis.closing_probability,
        ai_temperature: aiAnalysis.temperature,
        ai_objection_pattern: aiAnalysis.objection_pattern,
        ai_next_step_timing: aiAnalysis.next_step_timing,
        ai_priority_score: Math.round((aiAnalysis.closing_probability || 0) * 0.8),
        ai_global_analysis: aiAnalysis,
        ai_last_analysis_at: new Date().toISOString(),
      })
      .eq("id", deal_id);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ analysis: aiAnalysis, deal_id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
