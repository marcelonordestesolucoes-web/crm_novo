import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Card, Button, Badge } from '@/components/ui';
import { ProfileTab } from './tabs/ProfileTab';
import { TeamTab } from './tabs/TeamTab';
import { FunnelTab } from './tabs/FunnelTab';
import { GoalsTab } from './tabs/GoalsTab';
import { IntegrationsTab } from './tabs/IntegrationsTab';
import { cn } from '@/lib/utils';

export default function SettingsView() {
  const { user } = useAuth();
  const [activeTab, setActiveTab ] = useState('team');
  
  // Verifica se o usuário é Admin via metadata ou se podemos buscar do membership
  // No Login, o usuário viu "ADMIN" abaixo do nome do Marcelo, provavelmente vem do perfil/membership
  const isAdmin = user?.user_metadata?.role?.toUpperCase() === 'ADMIN' || 
                  user?.user_metadata?.role?.toUpperCase() === 'DIRETOR COMERCIAL' ||
                  user?.user_metadata?.role?.toUpperCase() === 'MODO ARQUITETO';

  const tabs = [
    { id: 'profile',      label: 'Meu Perfil (Modal)', icon: 'person' },
    { id: 'team',         label: 'Minha Equipe',    icon: 'group' },
    { id: 'funnels',      label: 'Funis de Venda',  icon: 'account_tree' },
    { id: 'goals',        label: 'Metas',           icon: 'target' },
    { id: 'integrations', label: 'Integrações',     icon: 'hub' },
  ];

  return (
    <div className="min-h-screen bg-surface p-8 lg:p-12">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <header className="mb-12">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-4 mb-3"
          >
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-3xl">settings</span>
            </div>
            <div>
              <h1 className="text-3xl font-manrope font-black text-on-surface tracking-tight">Configurações</h1>
              <p className="text-slate-400 font-medium text-sm">Gerencie sua conta e as preferências da equipe</p>
            </div>
          </motion.div>
        </header>

        <div className="flex flex-col lg:flex-row gap-10">
          
          {/* Sidebar Nav */}
          <aside className="w-full lg:w-72 shrink-0">
            <div className="space-y-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-inter font-bold text-sm transition-all duration-300",
                    activeTab === tab.id 
                      ? "bg-white text-primary shadow-xl shadow-slate-200/50 border border-slate-100" 
                      : "text-slate-400 hover:text-on-surface hover:bg-white/50"
                  )}
                >
                  <span className={cn(
                    "material-symbols-outlined text-xl",
                    activeTab === tab.id ? "text-primary" : "text-slate-300"
                  )} style={{ fontVariationSettings: activeTab === tab.id ? "'FILL' 1" : "'FILL' 0" }}>
                    {tab.icon}
                  </span>
                  {tab.label}
                  {['team', 'funnels', 'goals', 'integrations'].includes(tab.id) && !isAdmin && (
                     <span className="material-symbols-outlined text-xs ml-auto opacity-30">lock</span>
                  )}
                </button>
              ))}
            </div>

            <div className="mt-10 p-6 rounded-[2rem] bg-gradient-to-br from-primary/5 to-transparent border border-primary/10">
              <p className="text-[10px] font-extrabold text-primary uppercase tracking-[0.2em] mb-2">Plano Atual</p>
              <h4 className="text-lg font-black text-on-surface mb-4">Enterprise Edition</h4>
              <Button variant="outline" className="w-full text-xs h-9 rounded-xl">Falar com Suporte</Button>
            </div>
          </aside>

          {/* Tab Content */}
          <main className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                {activeTab === 'profile' && <ProfileTab />}
                {activeTab === 'team' && <TeamTab isAdmin={isAdmin} />}
                {activeTab === 'funnels' && <FunnelTab isAdmin={isAdmin} />}
                {activeTab === 'goals' && <GoalsTab isAdmin={isAdmin} />}
                {activeTab === 'integrations' && <IntegrationsTab />}
              </motion.div>
            </AnimatePresence>
          </main>

        </div>
      </div>
    </div>
  );
}
