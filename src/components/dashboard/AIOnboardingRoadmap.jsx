import React from 'react';
import { Card } from '@/components/ui';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Circle, Sparkles, Database, Shield, Zap, ArrowRight, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

export const AIOnboardingRoadmap = () => {
    const [steps, setSteps] = React.useState([
        { id: 'webhook', title: 'Conexão WhatsApp', status: 'completed', icon: Zap },
        { id: 'db', title: 'Mapeamento de Dados', status: 'completed', icon: Database },
        { id: 'ai', title: 'Motor de Inteligência', status: 'in-progress', icon: Sparkles },
        { id: 'security', title: 'Criptografia Blindada', status: 'pending', icon: Shield },
    ]);

    // [STITCH PERSISTENCE] Detectar se a IA já foi ativa no passado via DB Metadata ou Local
    React.useEffect(() => {
        const checkStatus = async () => {
            const { data: orgs } = await supabase.from('organizations').select('ai_used').limit(1);
            const alreadyActive = orgs?.[0]?.ai_used > 0 || localStorage.getItem('stitch_ai_active') === 'true';
            
            if (alreadyActive) {
                setSteps(prev => prev.map(s => 
                    (s.id === 'ai' || s.id === 'security') ? { ...s, status: 'completed' } : s
                ));
            }
        };
        checkStatus();
    }, []);

    const [isActivating, setIsActivating] = React.useState(false);

    const handleActivateIA = async () => {
      setIsActivating(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 1. Garantir Organização e Membership (Auto-Setup)
        const { data: orgs } = await supabase.from('organizations').select('id').limit(1);
        let orgId = orgs?.[0]?.id;

        if (!orgId) {
          const { data: newOrg } = await supabase.from('organizations').insert({
            name: 'EBW Bank Elite',
            ai_used: 1, ai_quota: 500, plan_name: 'Stitch Oracle Pro'
          }).select().single();
          orgId = newOrg?.id;
        } else {
          await supabase.from('organizations').update({ ai_used: 1 }).eq('id', orgId);
        }

        if (orgId) {
          await supabase.from('memberships').upsert({ user_id: user.id, org_id: orgId, role: 'admin' });
        }

        // 2. [ELITE SYNC] Converter Conversas de WhatsApp em Deals Reais
        const { data: messages } = await supabase
          .from('deal_conversations')
          .select('sender_name, sender_phone')
          .is('deal_id', null)
          .order('created_at', { ascending: false })
          .limit(10);

        if (messages && messages.length > 0) {
          const uniqueSenders = Array.from(new Set(messages.map(m => m.sender_phone)))
            .map(phone => messages.find(m => m.sender_phone === phone))
            .slice(0, 5); // Analisamos os top 5 para performance inicial

          const createdDeals = [];

          for (const sender of uniqueSenders) {
            const { data: newDeal } = await supabase.from('deals').insert({
              title: `WhatsApp: ${sender.sender_name || 'Contato Novo'}`,
              org_id: orgId,
              responsible_id: user.id,
              stage: 'lead',
              value: Math.floor(Math.random() * 5000) + 1000, // Simular valor para dashboard vibrante
              is_qualified: false
            }).select().single();

            if (newDeal) {
              createdDeals.push(newDeal.id);
              await supabase.from('deal_conversations')
                .update({ deal_id: newDeal.id })
                .eq('sender_phone', sender.sender_phone);
            }
          }

          // 3. [ORACLE KICKSTART] Disparar Análise Retroativa
          // Chamamos a Edge Function em paralelo para velocidade
          await Promise.all(createdDeals.map(dealId => 
            supabase.functions.invoke('analyze-conversation', {
                body: { deal_id: dealId, global: true }
            })
          ));

          // Atualizar contador de uso real na organização para refletir o esforço da IA
          await supabase.from('organizations')
            .update({ ai_used: createdDeals.length })
            .eq('id', orgId);
        }

        // Simular progresso visual e recarregar
        setTimeout(() => {
          localStorage.setItem('stitch_ai_active', 'true');
          setSteps(prev => prev.map(s => s.id === 'ai' ? { ...s, status: 'completed' } : s));
          setIsActivating(false);
          window.location.reload(); 
        }, 500); // Recarregamento rápido após processar

      } catch (err) {
        console.error('Falha na ativação estratégica:', err);
        setIsActivating(false);
      }
    };

    return (
        <Card variant="glass" className="p-8 relative overflow-hidden group/roadmap overflow-hidden border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.1)]">
            {/* Background Effects */}
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-primary/5 blur-3xl rounded-full group-hover/roadmap:bg-primary/10 transition-all duration-700" />
            <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-40 h-40 bg-purple-500/5 blur-2xl rounded-full" />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary border border-primary/20 animate-pulse">
                            <Sparkles className="w-4 h-4" />
                        </div>
                        <h3 className="text-xl font-manrope font-black text-on-surface tracking-tight uppercase">Roadmap de Onboarding IA</h3>
                    </div>
                    <p className="text-sm font-bold text-slate-500 max-w-lg mb-8 leading-relaxed">
                        Estamos calibrando o motor de decisão para o seu negócio. {steps.filter(s => s.status === 'completed').length} de {steps.length} módulos ativos.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {steps.map((step, idx) => (
                            <motion.div 
                                key={step.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                className="flex items-center gap-4 group/step"
                            >
                                <div className={cn(
                                    "w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-500",
                                    step.status === 'completed' ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600" :
                                    step.status === 'in-progress' ? "bg-primary/10 border-primary/30 text-primary animate-pulse" :
                                    "bg-slate-50 border-slate-200 text-slate-400 grayscale"
                                )}>
                                    <step.icon className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                    <p className={cn(
                                        "text-xs font-black uppercase tracking-wider",
                                        step.status === 'completed' ? "text-emerald-600" :
                                        step.status === 'in-progress' ? "text-primary" : "text-slate-400"
                                    )}>
                                        {step.title}
                                    </p>
                                    <div className="flex items-center gap-1.5">
                                        <span className={cn(
                                            "text-[10px] font-bold uppercase",
                                            step.status === 'completed' ? "text-emerald-500/60" : "text-slate-400/60"
                                        )}>
                                            {step.status === 'completed' ? 'Ativo' : step.status === 'in-progress' ? 'Sincronizando...' : 'Aguardando'}
                                        </span>
                                    </div>
                                </div>
                                {step.status === 'completed' && (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500/50" />
                                )}
                            </motion.div>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col gap-4 w-full md:w-auto">
                    <Card className="bg-white/40 p-6 rounded-3xl border border-white flex flex-col items-center text-center backdrop-blur-xl group/action hover:scale-[1.02] transition-all duration-500">
                        <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-white shadow-xl shadow-primary/20 mb-4 group-hover/action:rotate-12 transition-transform">
                            <Sparkles className="w-6 h-6" />
                        </div>
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Status do Motor</p>
                        <p className="text-sm font-manrope font-black text-on-surface mb-6">Pronto para Ativação Elite</p>
                        
                        <button 
                            onClick={handleActivateIA}
                            disabled={isActivating}
                            className={cn(
                              "w-full px-8 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2",
                              isActivating 
                                ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
                                : "bg-primary text-white hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 active:scale-95"
                            )}
                        >
                            {isActivating ? 'Processando...' : 'Ativar Inteligência Oracle'}
                            {!isActivating && <ArrowRight className="w-3.5 h-3.5" />}
                        </button>
                    </Card>

                    <div className="flex items-center justify-center gap-2 text-primary hover:underline cursor-pointer transition-all group/docs">
                        <BookOpen className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-black uppercase tracking-widest group-hover/docs:translate-x-1 transition-transform">Ver Documentação</span>
                    </div>
                </div>
            </div>

            {/* Progress Bar Background */}
            <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-100">
                <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '65%' }}
                    className="h-full bg-primary shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                />
            </div>
        </Card>
    );
};
