import React from 'react';
import { motion } from 'framer-motion';
import { Card, Button } from '@/components/ui';
import { Mail, MessageCircle, Calendar, Shield, Cpu, Zap, ChevronLeft } from 'lucide-react';
import { AIAnalyticsView } from '@/components/settings/AIAnalyticsView';

const IntegrationCard = ({ icon: Icon, title, description, badge, color, status = 'disponível', onConfigure }) => (
  <Card className="p-8 bg-white border-slate-100 hover:shadow-2xl hover:scale-[1.02] transition-all group overflow-hidden relative">
    <div className={`absolute top-0 right-10 w-24 h-24 rounded-full opacity-5 blur-2xl ${color}`} />
    
    <div className="flex justify-between items-start mb-6">
      <div className={`w-14 h-14 rounded-2xl ${color} bg-opacity-10 flex items-center justify-center text-current`}>
        <Icon className="w-7 h-7" />
      </div>
      <span className="text-[9px] font-black px-3 py-1 bg-slate-100 text-slate-500 rounded-full uppercase tracking-widest">
        {status}
      </span>
    </div>

    <h4 className="text-lg font-manrope font-black text-on-surface mb-2 tracking-tight">{title}</h4>
    <p className="text-xs text-slate-400 font-medium leading-relaxed mb-8">{description}</p>
    
    <div className="flex items-center justify-between pt-6 border-t border-slate-50">
      <div className="flex gap-2">
         {badge && <span className="text-[10px] font-bold text-primary bg-primary/5 px-2 py-0.5 rounded-lg">{badge}</span>}
      </div>
      <Button 
        onClick={onConfigure}
        variant="outline" 
        size="sm" 
        className="h-9 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest group-hover:bg-primary group-hover:text-white transition-all"
      >
        Configurar
      </Button>
    </div>
  </Card>
);

export const IntegrationsTab = () => {
  const [activeView, setActiveView] = React.useState('grid');

  if (activeView === 'ia-analytics') {
    return (
      <div className="space-y-8">
        <button 
            onClick={() => setActiveView('grid')}
            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-primary transition-colors mb-4"
        >
            <ChevronLeft className="w-4 h-4" />
            Voltar para Integrações
        </button>
        <AIAnalyticsView />
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-20">
      
      {/* Intro */}
      <div className="max-w-2xl px-2">
        <h3 className="text-2xl font-manrope font-black text-on-surface tracking-tighter mb-4">Central de Conexões</h3>
        <p className="text-sm text-slate-400 font-medium leading-relaxed">
          Conecte o Stitch CRM às suas ferramentas favoritas para automatizar tarefas e centralizar toda a comunicação da equipe em um só lugar.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        
        <IntegrationCard 
          icon={MessageCircle}
          title="WhatsApp Business"
          description="Sincronize mensagens, alertas de pipeline e faça disparos automáticos de propostas diretamente para seus leads."
          color="text-emerald-500 bg-emerald-500"
          badge="Oficial Meta"
        />

        <IntegrationCard 
          icon={Mail}
          title="Google & Outlook"
          description="Envie e receba e-mails diretamente do CRM. Rastreie aberturas, cliques e agende sequências de follow-up."
          color="text-primary bg-primary"
          badge="OAuth 2.0"
        />

        <IntegrationCard 
          icon={Calendar}
          title="Calendário"
          description="Sincronização bidirecional de reuniões e tarefas. Evite conflitos de agenda e agende reuniões via link."
          color="text-amber-500 bg-amber-500"
          badge="iCal / Google"
        />

        <IntegrationCard 
          icon={Zap}
          title="Webhooks & API"
          description="Conecte qualquer ferramenta externa via Webhooks ou utilize nossa API robusta para automações avançadas."
          color="text-violet-500 bg-violet-500"
          badge="Enterprise"
        />

        <IntegrationCard 
          icon={Shield}
          title="Segurança & Backup"
          description="Logs de auditoria, backups automáticos diários em S3 e criptografia de ponta a ponta dos seus dados."
          color="text-slate-500 bg-slate-500"
          status="ativo"
        />

        <IntegrationCard 
          icon={Cpu}
          title="IA Preditiva"
          description="Análise automática de leads e sugestão de próximas ações baseada no histórico de conversão da equipe."
          color="text-sky-500 bg-sky-500"
          badge="Enterprise"
          status="ativo"
          onConfigure={() => setActiveView('ia-analytics')}
        />

      </div>

    </div>
  );
};
