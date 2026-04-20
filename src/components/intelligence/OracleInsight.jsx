import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Card, LoadingSpinner, GlassCard, Badge, Button } from '@/components/ui';
import { getImpactTheme, translateStrategy } from '@/utils/aiMappers';
import { Sparkles, ArrowRight, Copy, CheckCircle2, AlertTriangle, ThumbsUp, ThumbsDown, X, Info } from 'lucide-react';
import { trackUserEvent, submitAIFeedback } from '@/services/aiTracking';

/**
 * REVENUE INTELLIGENCE CARD (Elite Decision Cockpit — Phase 5)
 * Este componente agora aprende com o usuário e mede impacto real.
 */
export const OracleInsight = ({ dealId, dealInsight, messageId, onAction, onCopy }) => {
  const [copied, setCopied] = React.useState(false);
  const [feedbackStatus, setFeedbackStatus] = React.useState(null); // 'positive', 'negative'
  const [showFeedbackModal, setShowFeedbackModal] = React.useState(false);
  const [showOnboarding, setShowOnboarding] = React.useState(false);

  // 1. TRACKING AUTOMÁTICO (Visualização e Onboarding)
  React.useEffect(() => {
    if (dealInsight) {
      trackUserEvent(dealId, 'ai_insight_viewed', { messageId });
      
      // Checa Onboarding (1ª vez via LocalStorage para performance)
      const hasSeenOnboarding = localStorage.getItem('stitch_ai_onboarding_seen');
      if (!hasSeenOnboarding) {
        setShowOnboarding(true);
      }

      // Timer para "Ignorou a IA" (30 segundos sem ação)
      const timer = setTimeout(() => {
        // Se após 30s não clicou em nada nem deu feedback, loga como ignorado
        trackUserEvent(dealId, 'ai_ignored', { messageId });
      }, 30000);

      return () => clearTimeout(timer);
    }
  }, [dealId, dealInsight, messageId]);

  if (!dealInsight) {
    return (
      <Card variant="glass" className="p-8 flex flex-col items-center justify-center text-center opacity-60 grayscale min-h-[300px]">
        <Sparkles className="w-12 h-12 text-slate-300 mb-4 animate-pulse" />
        <p className="font-manrope font-black text-slate-400 uppercase tracking-widest text-xs">
          Aguardando nova mensagem para análise...
        </p>
      </Card>
    );
  }

  const theme = getImpactTheme(dealInsight.deal_impact);
  const strategyLabel = translateStrategy(dealInsight.recommended_action?.strategy);
  
  const handleAction = () => {
    trackUserEvent(dealId, 'ai_action_clicked', { messageId, actionType: dealInsight.recommended_action?.type });
    if (onAction) onAction(dealInsight.recommended_action);
  };

  const handleCopy = () => {
    trackUserEvent(dealId, 'ai_message_copied', { messageId });
    if (onCopy) onCopy(dealInsight.recommended_action?.message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFeedback = async (type, errorType = null) => {
    setFeedbackStatus(type);
    await submitAIFeedback(messageId, dealId, type, errorType);
    setShowFeedbackModal(false);
  };

  const closeOnboarding = () => {
    localStorage.setItem('stitch_ai_onboarding_seen', 'true');
    setShowOnboarding(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full relative group/oracle"
    >
      {/* ONBOARDING OVERLAY */}
      <AnimatePresence>
        {showOnboarding && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-primary/90 backdrop-blur-xl rounded-[2.5rem] p-8 flex flex-col items-center justify-center text-center text-white"
          >
            <Sparkles className="w-16 h-16 mb-6 text-amber-300" />
            <h4 className="text-xl font-manrope font-black uppercase tracking-tight mb-4">Bem-vindo ao Oracle</h4>
            <p className="text-sm font-medium opacity-90 leading-relaxed mb-8">
              Este sistema analisa suas conversas e te diz exatamente o próximo passo para fechar o negócio. Use as recomendações para acelerar suas vendas.
            </p>
            <Button onClick={closeOnboarding} className="bg-white text-primary hover:bg-white/90 px-10 py-6 rounded-full font-black uppercase tracking-widest text-[10px]">
              Entendi, mostrar insight
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <GlassCard 
        className="p-8 overflow-hidden border-white/40 shadow-2xl bg-white/40 backdrop-blur-3xl"
        beam={true}
        beamColor={dealInsight.deal_impact >= 0.3 ? "radial-gradient(circle, #10b981 0%, transparent 70%)" : "radial-gradient(circle, #f43f5e 0%, transparent 70%)"}
      >
        {/* Header and Emotional Status */}
        <div className="flex justify-between items-start mb-8">
          <div className="flex flex-col gap-1">
            <Badge variant="outline" className={cn("px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border-white/60", theme.bg, theme.color)}>
              Oracle Revenue Intelligence
            </Badge>
            <h3 className="text-2xl font-manrope font-black text-on-surface tracking-tight mt-4">
              {theme.label} ({dealInsight.deal_impact > 0 ? '+' : ''}{(dealInsight.deal_impact * 100).toFixed(0)}%)
            </h3>
          </div>
          <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg", theme.bg, theme.color)}>
            <theme.icon className="w-6 h-6" />
          </div>
        </div>

        {/* Insight Insight */}
        <div className="mb-10">
          <p className="text-lg font-inter font-medium text-slate-600 leading-relaxed italic">
            "{dealInsight.stage_insight}"
          </p>
        </div>

        {/* Decision Protocols (Visual Reasoning) */}
        <div className="grid grid-cols-2 gap-4 mb-10">
          <div className="p-4 bg-white/40 rounded-2xl border border-white/60">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Urgência</p>
            <p className="text-xs font-black text-on-surface">{dealInsight.urgency_level || 'Normal'}</p>
          </div>
          <div className="p-4 bg-white/40 rounded-2xl border border-white/60">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Estratégia</p>
            <p className="text-xs font-black text-on-surface">{strategyLabel}</p>
          </div>
        </div>

        {/* PRIMARY ACTION */}
        <div className="space-y-4">
          <button 
            onClick={handleAction}
            className={cn(
              "w-full py-6 rounded-[2rem] text-sm font-black uppercase tracking-[0.2em] shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3 border-4 border-white",
              dealInsight.deal_impact >= 0.3 ? "bg-emerald-500 text-white" : "bg-primary text-white"
            )}
          >
            {dealInsight.recommended_action?.type.replace('_', ' ')}
            <ArrowRight className="w-5 h-5" />
          </button>

          <div className="flex gap-4">
            <button 
              onClick={handleCopy}
              className="flex-1 py-4 bg-white/60 hover:bg-white text-slate-500 hover:text-primary rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-slate-100 shadow-sm"
            >
              {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copiado!' : 'Copiar Sugestão'}
            </button>
            
            {/* 2-STEP FEEDBACK LOOP */}
            <div className="flex gap-2">
              <button 
                onClick={() => handleFeedback('positive')}
                className={cn(
                  "w-12 h-12 flex items-center justify-center rounded-2xl border transition-all",
                  feedbackStatus === 'positive' ? "bg-emerald-500 text-white border-emerald-500" : "bg-white/40 border-slate-100 text-slate-400 hover:text-emerald-500"
                )}
              >
                <ThumbsUp className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setShowFeedbackModal(true)}
                className={cn(
                  "w-12 h-12 flex items-center justify-center rounded-2xl border transition-all",
                  feedbackStatus === 'negative' ? "bg-rose-500 text-white border-rose-500" : "bg-white/40 border-slate-100 text-slate-400 hover:text-rose-500"
                )}
              >
                <ThumbsDown className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* FEEDBACK STRUCTURED DIALOG (2-Step) */}
        <AnimatePresence>
          {showFeedbackModal && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
              className="absolute inset-x-4 bottom-4 z-40 bg-white/95 backdrop-blur-2xl rounded-3xl p-6 shadow-2xl border border-slate-100"
            >
              <div className="flex justify-between items-center mb-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">O que houve de errado?</p>
                <X className="w-4 h-4 text-slate-300 cursor-pointer" onClick={() => setShowFeedbackModal(false)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'context_mismatch', label: 'Fora de contexto' },
                  { id: 'bad_strategy', label: 'Estratégia ruim' },
                  { id: 'low_quality', label: 'Resposta fraca' },
                  { id: 'wrong_timing', label: 'Timing errado' }
                ].map(opt => (
                  <button 
                    key={opt.id}
                    onClick={() => handleFeedback('negative', opt.id)}
                    className="py-3 px-4 bg-slate-50 hover:bg-slate-100 rounded-xl text-[10px] font-bold text-slate-600 transition-all text-left"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* HINT PERSISTENTE */}
        {!showOnboarding && !feedbackStatus && (
          <div className="mt-6 flex items-center justify-center gap-2 opacity-40">
            <Info className="w-3 h-3 text-slate-400" />
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Baseado na conversa, recomendamos esta ação.</p>
          </div>
        )}
      </GlassCard>
    </motion.div>
  );
};
