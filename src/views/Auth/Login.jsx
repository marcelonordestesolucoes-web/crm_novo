import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { ROUTES } from '@/constants/config';
import { Card, Button } from '@/components/ui';
import { Fingerprint, Lock, Mail, AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isResetMode, setIsResetMode] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const { login, resetPassword } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      navigate(ROUTES.HOME, { replace: true });
    } catch (err) {
      console.error(err);
      setError('Credenciais inválidas. Verifique seu email e senha e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      await resetPassword(email);
      setSuccess('Se o email estiver cadastrado, você receberá um link para redefinir sua senha em instantes.');
    } catch (err) {
      console.error(err);
      setError('Ocorreu um erro ao processar sua solicitação. Tente novamente mais tarde.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-tertiary/20 blur-[120px] rounded-full pointer-events-none" />

      {/* Brand Header */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="mb-8 flex flex-col items-center gap-3 relative z-10"
      >
        <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
          <span className="material-symbols-outlined text-white text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            layers
          </span>
        </div>
        <h1 className="font-headline font-extrabold text-3xl text-on-surface tracking-tight">Stitch<span className="text-primary">CRM</span></h1>
        <p className="text-sm font-body font-medium text-on-surface-variant uppercase tracking-widest">Enterprise Edition</p>
      </motion.div>

      {/* Cards Container with AnimatePresence */}
      <div className="w-full max-w-md relative z-10 min-h-[500px]">
        <AnimatePresence mode="wait">
          {!isResetMode ? (
            <motion.div 
              key="login"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <Card className="p-10 backdrop-blur-xl bg-white/90 border border-white/40 shadow-2xl shadow-slate-200/50">
                <div className="text-center mb-10">
                  <h2 className="text-2xl font-headline font-bold text-on-surface mb-2 tracking-tight">Acesso Corporativo</h2>
                  <p className="text-sm text-slate-500 font-medium">Use suas credenciais para gerenciar seu pipeline</p>
                </div>

                {error && (
                  <div className="mb-6 p-4 bg-error/10 border border-error/20 rounded-2xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-error shrink-0 mt-0.5" />
                    <p className="text-sm font-medium text-error leading-relaxed">{error}</p>
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">E-mail</label>
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-primary transition-colors" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-slate-50/50 border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-medium text-on-surface focus:outline-none focus:border-primary/40 focus:bg-white transition-all"
                        placeholder="nome@empresa.com"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between ml-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Senha</label>
                      <button 
                        type="button" 
                        onClick={() => setIsResetMode(true)}
                        className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline"
                      >
                        Esqueceu a senha?
                      </button>
                    </div>
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

                  <Button
                    type="submit"
                    loading={loading}
                    className="w-full py-5 rounded-2xl bg-primary shadow-lg shadow-primary/25"
                  >
                    <Fingerprint className="w-5 h-5 mr-1" />
                    Entrar no Sistema
                  </Button>
                </form>
              </Card>
            </motion.div>
          ) : (
            <motion.div 
              key="reset"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <Card className="p-10 backdrop-blur-xl bg-white/90 border border-white/40 shadow-2xl shadow-slate-200/50">
                <button 
                  onClick={() => {
                    setIsResetMode(false);
                    setError(null);
                    setSuccess(null);
                  }}
                  className="flex items-center gap-2 text-slate-400 hover:text-primary transition-colors mb-8 group"
                >
                  <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Voltar para Login</span>
                </button>

                <div className="text-center mb-10">
                  <h2 className="text-2xl font-headline font-bold text-on-surface mb-2 tracking-tight">Recuperar Acesso</h2>
                  <p className="text-sm text-slate-500 font-medium">Enviaremos um link de reset para o seu email</p>
                </div>

                {error && (
                  <div className="mb-6 p-4 bg-error/10 border border-error/20 rounded-2xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-error shrink-0 mt-0.5" />
                    <p className="text-sm font-medium text-error leading-relaxed">{error}</p>
                  </div>
                )}

                {success && (
                  <motion.div 
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="mb-6 p-6 bg-emerald-50 border border-emerald-100 rounded-2xl text-center"
                  >
                    <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 text-white shadow-lg shadow-emerald-200">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-bold text-emerald-700 leading-relaxed">{success}</p>
                  </motion.div>
                )}

                {!success && (
                  <form onSubmit={handleResetPassword} className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">E-mail Corporativo</label>
                      <div className="relative group">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-primary transition-colors" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full bg-slate-50/50 border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-medium text-on-surface focus:outline-none focus:border-primary/40 focus:bg-white transition-all"
                          placeholder="seu.nome@empresa.com"
                          required
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      loading={loading}
                      className="w-full py-5 rounded-2xl bg-slate-900"
                    >
                      Enviar Link de Reset
                    </Button>
                  </form>
                )}
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer info */}
      <p className="absolute bottom-6 text-xs font-medium text-slate-400/80">
        &copy; {new Date().getFullYear()} Stitch CRM. By EBW Bank.
      </p>
    </div>
  );
}
