import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, Button, LoadingSpinner, Avatar } from '@/components/ui';
import { getOrgGoal, upsertOrgGoal, getTeamMembersWithGoal } from '@/services/goals';
import { Target, TrendingUp, Users, Calendar } from 'lucide-react';
import { formatCurrency } from '@/constants/config';

export const GoalsTab = ({ isAdmin }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [goal, setGoal] = useState({ amount: 0, month: new Date().getMonth() + 1, year: new Date().getFullYear() });
  const [team, setTeam] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [goalData, teamData] = await Promise.all([
        getOrgGoal(goal.month, goal.year),
        getTeamMembersWithGoal()
      ]);
      if (goalData) setGoal(goalData);
      setTeam(teamData);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveGoal() {
    try {
      setSaving(true);
      await upsertOrgGoal(goal.amount, goal.month, goal.year);
      alert('Meta atualizada com sucesso!');
    } catch (error) {
      alert('Erro ao salvar meta: ' + error.message);
    } finally {
      setSaving(false);
    }
  }

  const distributedAmount = team.length > 0 ? goal.amount / team.length : 0;

  if (loading) return <div className="py-20 flex justify-center"><LoadingSpinner /></div>;

  return (
    <div className="space-y-8 pb-20">
      
      {/* Resumo da Meta */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 bg-gradient-to-br from-primary to-primary-container text-white border-0 shadow-2xl shadow-primary/20">
          <Target className="w-8 h-8 mb-4 opacity-60" />
          <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">Meta Global (Mês)</p>
          <h3 className="text-2xl font-manrope font-black tracking-tighter">{formatCurrency(goal.amount)}</h3>
        </Card>

        <Card className="p-6 bg-white border-slate-100 shadow-xl">
          <Users className="w-8 h-8 mb-4 text-primary opacity-20" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total de Consultores</p>
          <h3 className="text-2xl font-manrope font-black text-on-surface tracking-tighter">{team.length} membros</h3>
        </Card>

        <Card className="p-6 bg-white border-slate-100 shadow-xl">
          <TrendingUp className="w-8 h-8 mb-4 text-emerald-500 opacity-20" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Cota por Consultor</p>
          <h3 className="text-2xl font-manrope font-black text-on-surface tracking-tighter">{formatCurrency(distributedAmount)}</h3>
        </Card>
      </div>

      {isAdmin ? (
        <Card className="p-10 bg-white/40 backdrop-blur-xl border-white/60 shadow-2xl overflow-hidden relative">
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-8">
              <Calendar className="text-primary w-5 h-5" />
              <h4 className="font-manrope font-black text-on-surface uppercase text-xs tracking-widest">Configurar Meta do Mês</h4>
            </div>

            <div className="flex flex-col md:flex-row gap-6 items-end">
              <div className="flex-1 space-y-2">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest ml-1">Valor Total da Organização (R$)</label>
                <input 
                  type="number"
                  className="w-full bg-white/50 border border-white/80 rounded-2xl py-4 px-6 text-lg font-black text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  value={goal.amount}
                  onChange={e => setGoal({ ...goal, amount: Number(e.target.value) })}
                  placeholder="Ex: 100000"
                />
              </div>
              <Button 
                variant="primary" 
                onClick={handleSaveGoal} 
                disabled={saving}
                className="h-14 px-10 rounded-2xl shadow-xl shadow-primary/20 active:scale-95"
              >
                {saving ? <LoadingSpinner size="sm" color="white" /> : 'Atualizar Meta'}
              </Button>
            </div>
            <p className="mt-4 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              * A meta será dividida igualmente entre todos os consultores ativos da organização.
            </p>
          </div>
        </Card>
      ) : (
        <div className="p-10 rounded-[2rem] bg-amber-50 border border-amber-100 flex items-center gap-4 text-amber-700">
          <span className="material-symbols-outlined">warning</span>
          <p className="text-xs font-bold uppercase tracking-widest">Apenas administradores podem alterar a meta global.</p>
        </div>
      )}

      {/* Listagem da Distribuição */}
      <section>
        <h4 className="text-xs font-black text-on-surface uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
          <span className="w-6 h-px bg-slate-200" />
          Distribuição Automática
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-on-surface">
          {team.map((member) => (
            <motion.div
              layout
              key={member.id}
              className="flex items-center justify-between p-5 bg-white border border-slate-100 rounded-3xl shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-4">
                <Avatar 
                  src={member.profiles?.avatar_url} 
                  name={member.profiles?.full_name} 
                  className="w-16 h-16 rounded-[2rem] shadow-xl border-2"
                />
                <div>
                  <p className="text-sm font-black text-on-surface">{member.profiles?.full_name}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{member.role === 'admin' ? 'Administrador' : 'Consultor'}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-black text-primary tracking-tighter">{formatCurrency(distributedAmount)}</p>
                <div className="w-16 h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                   <div className="w-1/3 h-full bg-primary/30 rounded-full" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

    </div>
  );
};
