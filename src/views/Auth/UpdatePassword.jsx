import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { ROUTES } from '@/constants/config';
import { Card, Button } from '@/components/ui';
import { Lock, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';

/**
 * TELA DE DEFINIÇÃO DE NOVA SENHA (Fase Reset)
 * Acessada após o usuário clicar no link de recuperação enviado por email.
 */
export default function UpdatePassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const { updatePassword } = useAuth();
  const navigate = useNavigate();

  const handleUpdate = async (e) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);

    try {
      await updatePassword(password);
      setSuccess(true);
      // Aguarda 3 segundos e redireciona para a home ou login
      setTimeout(() => {
        navigate(ROUTES.HOME, { replace: true });
      }, 3000);
    } catch (err) {
      console.error(err);
      setError('Erro ao atualizar senha. O link pode ter expirado ou o serviço está temporariamente fora do ar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Brand Header */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 flex flex-col items-center gap-3 relative z-10"
      >
        <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
             <ShieldCheck className="text-white w-8 h-8" />
        </div>
        <h1 className="font-headline font-extrabold text-3xl text-on-surface tracking-tight">Redefinir <span className="text-primary">Acesso</span></h1>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md relative z-10"
      >
        <Card className="p-10 backdrop-blur-xl bg-white/90 border border-white/40 shadow-2xl shadow-slate-200/50">
          {!success ? (
            <>
              <div className="text-center mb-10">
                <h2 className="text-xl font-headline font-bold text-on-surface mb-2 tracking-tight">Nova Senha</h2>
                <p className="text-sm text-slate-500 font-medium">Escolha uma senha forte para sua segurança</p>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-error/10 border border-error/20 rounded-2xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-error shrink-0 mt-0.5" />
                  <p className="text-sm font-medium text-error leading-relaxed">{error}</p>
                </div>
              )}

              <form onSubmit={handleUpdate} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nova Senha</label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-primary transition-colors" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-50/50 border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-medium text-on-surface focus:outline-none focus:border-primary/40 focus:bg-white transition-all"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirmar Senha</label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-primary transition-colors" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-slate-50/50 border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-medium text-on-surface focus:outline-none focus:border-primary/40 focus:bg-white transition-all"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  loading={loading}
                  className="w-full py-5 rounded-2xl bg-primary"
                >
                  Atualizar Senha
                </Button>
              </form>
            </>
          ) : (
            <div className="text-center py-10">
              <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 text-white shadow-xl shadow-emerald-200">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-headline font-bold text-on-surface mb-2">Sucesso!</h2>
              <p className="text-sm font-medium text-slate-500 leading-relaxed">
                Sua senha foi redefinida com sucesso. 
                <br />Sincronizando seu dashboard...
              </p>
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
