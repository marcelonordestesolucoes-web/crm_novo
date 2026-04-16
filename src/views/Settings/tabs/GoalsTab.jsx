import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, Button, LoadingSpinner, Avatar } from '@/components/ui';
import { getOrgGoal, upsertOrgGoal, getTeamMembersWithGoal, upsertMemberGoal, getMyMemberGoal } from '@/services/goals';
import { Target, TrendingUp, Users, Calendar, Save, UserCheck, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/constants/config';

export const GoalsTab = ({ isAdmin }) => {
  const [loading, setLoading] = useState(true);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [savingIndividual, setSavingIndividual] = useState(false);
  const [goal, setGoal] = useState({ amount: 0, month: new Date().getMonth() + 1, year: new Date().getFullYear() });
  const [myGoal, setMyGoal] = useState(null);
  const [team, setTeam] = useState([]);
  const [memberGoaldrafts, setMemberGoalDrafts] = useState({});

  useEffect(() => {
    loadData();
  }, [goal.month, goal.year]);

  async function loadData() {
    try {
      setLoading(true);
      const [goalData, teamData, myGoalData] = await Promise.all([
        getOrgGoal(goal.month, goal.year),
        getTeamMembersWithGoal(goal.month, goal.year),
        !isAdmin ? getMyMemberGoal(goal.month, goal.year) : Promise.resolve(null)
      ]);
      
      if (goalData) setGoal(goalData);
      setTeam(teamData);
      setMyGoal(myGoalData);

      // Inicializa os rascunhos com o que vem do banco
      const drafts = {};
      teamData.forEach(m => {
        drafts[m.user_id] = m.individualGoal || 0;
      });
      setMemberGoalDrafts(drafts);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveGlobalGoal() {
    try {
      setSavingGlobal(true);
      await upsertOrgGoal(goal.amount, goal.month, goal.year);
      alert('Meta global atualizada!');
    } catch (error) {
      alert('Erro: ' + error.message);
    } finally {
      setSavingGlobal(false);
    }
  }

  async function handleSaveIndividualGoals() {
    try {
      setSavingIndividual(true);
      const promises = Object.entries(memberGoaldrafts).map(([userId, amount]) => 
        upsertMemberGoal(userId, amount, goal.month, goal.year)
      );
      await Promise.all(promises);
      alert('Metas individuais salvas com sucesso!');
      loadData();
    } catch (error) {
      alert('Erro ao salvar metas: ' + error.message);
    } finally {
      setSavingIndividual(false);
    }
  }

  const totalIndividualSum = Object.values(memberGoaldrafts).reduce((a, b) => a + b, 0);
  const distributionGap = goal.amount - totalIndividualSum;

  if (loading) return <div className="py-20 flex justify-center"><LoadingSpinner /></div>;

  return (
    <div className="space-y-8 pb-20">
      
      {/* Resumo da Meta */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 bg-slate-900 text-white border-0 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
            <Target className="w-16 h-16" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-1">Meta Global da Empresa</p>
          <h3 className="text-3xl font-manrope font-black tracking-tighter">{formatCurrency(goal.amount)}</h3>
          {!isAdmin && myGoal && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Sua Meta Pessoal</p>
              <p className="text-xl font-black">{formatCurrency(myGoal.amount)}</p>
            </div>
          )}
        </Card>

        <Card className="p-6 bg-white border-slate-100 shadow-xl">
          <Users className="w-8 h-8 mb-4 text-primary opacity-20" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total de Membros</p>
          <h3 className="text-2xl font-manrope font-black text-on-surface tracking-tighter">{team.length}</h3>
        </Card>

        <Card className="p-6 bg-white border-slate-100 shadow-xl">
          <TrendingUp className="w-8 h-8 mb-4 text-emerald-500 opacity-20" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Soma das Metas Individuais</p>
          <h3 className={`text-2xl font-manrope font-black tracking-tighter ${totalIndividualSum > goal.amount ? 'text-emerald-600' : 'text-on-surface'}`}>
            {formatCurrency(totalIndividualSum)}
          </h3>
        </Card>
      </div>

      {isAdmin && (
        <Card className="p-10 bg-white border-slate-100 shadow-2xl relative overflow-hidden">
          <div className="flex items-center gap-3 mb-8">
            <Calendar className="text-primary w-5 h-5" />
            <h4 className="font-manrope font-black text-on-surface uppercase text-xs tracking-widest">Configurar Meta Estratégica</h4>
          </div>

          <div className="flex flex-col md:flex-row gap-6 items-end">
            <div className="flex-1 space-y-2">
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest ml-1">Meta Geral da Organização (R$)</label>
              <input 
                type="number"
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 text-lg font-black text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-manrope"
                value={goal.amount}
                onChange={e => setGoal({ ...goal, amount: Number(e.target.value) })}
                placeholder="Ex: 50000"
              />
            </div>
            <Button 
              variant="primary" 
              onClick={handleSaveGlobalGoal} 
              disabled={savingGlobal}
              className="h-14 px-10 rounded-2xl shadow-xl shadow-primary/20"
            >
              {savingGlobal ? <LoadingSpinner size="sm" color="white" /> : 'Salvar Meta Global'}
            </Button>
          </div>
        </Card>
      )}

      {/* Listagem da Distribuição Manual */}
      <section>
        <div className="flex items-center justify-between mb-8">
          <h4 className="text-xs font-black text-on-surface uppercase tracking-[0.2em] flex items-center gap-3">
            <span className="w-8 h-px bg-slate-200" />
            Distribuição de Metas Individuais
          </h4>
          
          {isAdmin && (
            <Button 
              onClick={handleSaveIndividualGoals} 
              disabled={savingIndividual}
              className="rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-200 flex items-center gap-2 px-6"
            >
              {savingIndividual ? <LoadingSpinner size="sm" color="white" /> : <Save className="w-4 h-4" />}
                Salvar Todas as Metas
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {team.map((member) => (
            <motion.div
              layout
              key={member.user_id}
              className={`p-6 bg-white border rounded-[2rem] shadow-sm hover:shadow-xl transition-all group ${memberGoaldrafts[member.user_id] > 0 ? 'border-emerald-100' : 'border-slate-100'}`}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <Avatar 
                    src={member.profiles?.avatar_url} 
                    name={member.profiles?.full_name} 
                    className="w-14 h-14 rounded-2xl shadow-lg border-2 border-white"
                  />
                  <div>
                    <p className="text-sm font-black text-on-surface">{member.profiles?.full_name}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{member.role === 'admin' ? 'Administrador' : 'Membro'}</p>
                  </div>
                </div>
                {memberGoaldrafts[member.user_id] > 0 && (
                  <div className="bg-emerald-50 text-emerald-600 p-2 rounded-xl">
                    <UserCheck className="w-5 h-5" />
                  </div>
                )}
              </div>

              {isAdmin ? (
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Meta Individual (R$)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">R$</span>
                    <input 
                      type="number"
                      value={memberGoaldrafts[member.user_id] || ''}
                      onChange={e => setMemberGoalDrafts({ ...memberGoaldrafts, [member.user_id]: Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 pl-12 pr-6 text-base font-black text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-manrope"
                      placeholder="0"
                    />
                  </div>
                </div>
              ) : (
                <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sua Meta Definida</span>
                  <span className="text-lg font-manrope font-black text-on-surface">{formatCurrency(member.individualGoal)}</span>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {isAdmin && distributionGap !== 0 && (
          <div className={`mt-8 p-6 rounded-3xl flex items-center gap-4 ${distributionGap > 0 ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
            <AlertCircle className="w-6 h-6 shrink-0" />
            <p className="text-xs font-bold leading-relaxed">
              {distributionGap > 0 
                ? `Ainda faltam ${formatCurrency(distributionGap)} para atingir a Meta Global da empresa.`
                : `A soma das metas individuais excede a Meta Global em ${formatCurrency(Math.abs(distributionGap))}.`
              }
            </p>
          </div>
        )}
      </section>

    </div>
  );
};
