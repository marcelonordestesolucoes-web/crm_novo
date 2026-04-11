import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, Button, LoadingSpinner } from '@/components/ui';
import { createInvitation } from '@/services/invitations';

export const InviteModal = ({ onClose, onSuccess }) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      setLoading(true);
      await createInvitation(email, role);
      onSuccess();
    } catch (error) {
      alert('Erro ao criar convite: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-navy/60 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <Card className="p-8 bg-white border border-white/40 shadow-2xl relative overflow-hidden">
          
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-xl font-manrope font-black text-on-surface tracking-tight">Novo Convite</h2>
              <p className="text-xs text-slate-400 font-medium">Adicione um novo membro à sua organização</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-400">
               <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest ml-1">E-mail do Convidado</label>
              <input
                type="email"
                required
                placeholder="exemplo@empresa.com"
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all shadow-inner"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest ml-1">Cargo / Nível de Acesso</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'member', label: 'Consultor', desc: 'Acesso às vendas' },
                  { id: 'admin',  label: 'Admin', desc: 'Acesso total' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setRole(opt.id)}
                    className={`p-4 rounded-2xl border-2 transition-all text-left ${
                      role === opt.id 
                        ? 'border-primary bg-primary/5 shadow-md shadow-primary/5' 
                        : 'border-slate-100 hover:border-slate-200'
                    }`}
                  >
                    <p className={`text-sm font-bold ${role === opt.id ? 'text-primary' : 'text-slate-600'}`}>{opt.label}</p>
                    <p className="text-[10px] text-slate-400 font-medium">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4 flex flex-col gap-3">
              <Button type="submit" disabled={loading} variant="primary" className="w-full h-14 rounded-2xl shadow-xl shadow-primary/20">
                {loading ? <LoadingSpinner size="sm" color="white" /> : 'Gerar Convite'}
              </Button>
              <Button type="button" variant="ghost" onClick={onClose} className="w-full rounded-2xl text-slate-400 text-xs">
                Cancelar
              </Button>
            </div>
          </form>

        </Card>
      </motion.div>
    </div>
  );
};
