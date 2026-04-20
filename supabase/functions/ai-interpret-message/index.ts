import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const NOISE_WORDS = ["ok", "blz", "👍", "kkk", "sim", "não", "vlw", "obrigado", "tchau"]

function isMeaningfulMessage(content: string): boolean {
  if (!content) return false
  const clean = content.trim().toLowerCase()
  if (clean.length < 3) return false
  if (NOISE_WORDS.includes(clean)) return false
  return true
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    const { record } = await req.json()
    if (!record || record.direction !== 'inbound') return new Response('Ignored', { status: 200 })

    const orgId = record.org_id
    const messageId = record.id
    const dealId = record.deal_id

    // 1. DEDUPLICATION
    if (record.metadata?.ai_status === 'processed') return new Response('Already processed', { status: 200 })

    // [PHASE 5] — BUSCA DE ORGANIZAÇÃO & FEATURE FLAG
    const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('ai_enabled, ai_feature_enabled, ai_quota, ai_used')
        .eq('id', orgId)
        .single()

    if (orgError || !org) throw new Error('Organization not found')

    // Rollout Control (Feature Flag)
    if (!org.ai_feature_enabled) {
        await supabase.from('messages').update({ ai_status: 'feature_disabled' }).eq('id', messageId)
        return new Response('AI Feature disabled', { status: 200 })
    }

    // 2. RATE LIMIT ATÔMICO
    const { data: allowed, error: rateError } = await supabase.rpc('check_and_increment_ai_rate_limit', { p_org_id: orgId })
    if (rateError || !allowed) {
      await supabase.from('messages').update({ ai_status: 'rate_limited' }).eq('id', messageId)
      return new Response('Rate limited', { status: 200 })
    }

    // 3. QUOTA CHECK
    if (!org.ai_enabled || org.ai_used >= org.ai_quota) {
      const status = org.ai_used >= org.ai_quota ? 'quota_exceeded' : 'plan_disabled'
      await supabase.from('messages').update({ ai_status: status }).eq('id', messageId)
      if (dealId && status === 'quota_exceeded') {
        await supabase.from('deals').update({ ai_blocked: true, ai_blocked_reason: status }).eq('id', dealId)
      }
      return new Response(status, { status: 200 })
    }

    // 4. FILTRO DE RUÍDO
    if (!isMeaningfulMessage(record.content)) {
      await supabase.from('messages').update({ ai_status: 'ignored_noise' }).eq('id', messageId)
      await supabase.rpc('increment_ai_saved_by_filter_with_history', { p_org_id: orgId })
      return new Response('Ignored noise', { status: 200 })
    }

    // 5. DATA FETCH (Contexto Profundo)
    const { data: deal } = await supabase.from('deals').select('title, value, stage, status').eq('id', dealId).single()
    const { data: timeline } = await supabase.from('deal_timeline').select('type, description, created_at').eq('deal_id', dealId).order('created_at', { ascending: false }).limit(3)

    // 6. AI ORCHESTRATION (Audit Log Elite)
    const systemPrompt = `Você é o Cérebro de Vendas do Stitch CRM... [Decision Engine Protocols]`
    const userPrompt = `Deal: ${JSON.stringify(deal)}\nHistórico: ${JSON.stringify(timeline)}\nMensagem: ${record.content}`

    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: "json_object" }
      })
    })

    if (!response.ok) {
        await supabase.from('messages').update({ ai_status: 'failed' }).eq('id', messageId)
        throw new Error('OpenAI API Failure')
    }
    
    const { choices, usage } = await response.json()
    const analysis = JSON.parse(choices[0].message.content)

    // 7. PERSISTENCE & AUDIT LOG (Padrão Enterprise)
    await supabase.from('messages').update({ 
        metadata: { 
            ...record.metadata, 
            ai_analysis: analysis,
            ai_audit: {
                tokens: usage,
                context_used: userPrompt,
                instructions_used: systemPrompt
            }
        }, 
        ai_status: 'processed'
    }).eq('id', messageId)

    if (dealId) {
      await supabase.from('deals').update({ 
        last_ai_insight: analysis, 
        last_ai_message_id: messageId, // Vínculo para feedback exato
        ai_last_updated_at: new Date().toISOString() 
      }).eq('id', dealId)
    }

    await supabase.rpc('increment_ai_usage_with_history', { p_org_id: orgId })

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('Field 5 Orchestrator Failure:', error)
    return new Response('Failed', { status: 200 })
  }
})
