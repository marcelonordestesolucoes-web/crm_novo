// src/views/Campaigns/CampaignWizard.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Users, 
  MessageSquare, 
  ShieldCheck, 
  ArrowRight, 
  ArrowLeft, 
  Check,
  Search,
  Zap,
  Info
} from 'lucide-react';
import { 
  Modal, 
  Button, 
  Badge, 
  LoadingSpinner, 
  Card,
  Avatar 
} from '@/components/ui';
import { getContacts } from '@/services/contacts';
import { createCampaign } from '@/services/campaigns';
import { useSupabase } from '@/hooks/useSupabase';
import { cn } from '@/lib/utils';

export default function CampaignWizard({ isOpen, onClose, onCreated }) {
  const [step, setStep] = useState(1);
  const { data: contacts, loading: loadingContacts } = useSupabase(getContacts);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    message_template: '',
    min_delay: 20,
    max_delay: 60
  });

  const filteredContacts = contacts?.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.company?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const toggleContact = (id) => {
    setSelectedContacts(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleNext = () => setStep(prev => prev + 1);
  const handleBack = () => setStep(prev => prev - 1);

  const handleCreate = async () => {
    if (!formData.name || !formData.message_template || selectedContacts.length === 0) {
      alert("Por favor, preencha todos os campos e selecione os contatos.");
      return;
    }

    try {
      setIsSaving(true);
      await createCampaign(formData, selectedContacts);
      onCreated();
      onClose();
      // Reset
      setStep(1);
      setSelectedContacts([]);
      setFormData({ name: '', message_template: '', min_delay: 20, max_delay: 60 });
    } catch (error) {
      console.error("Erro ao criar campanha:", error);
      alert("Erro ao criar campanha.");
    } finally {
      setIsSaving(false);
    }
  };

  const insertVariable = (variable) => {
    setFormData(prev => ({
      ...prev,
      message_template: prev.message_template + variable
    }));
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={null}
      className="max-w-4xl w-full"
    >
      <div className="flex flex-col h-[80vh]">
        {/* Header Customizado */}
        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-primary/5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-manrope font-black text-slate-800 leading-none">Configuração de Disparo Elite</h3>
              <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mt-1">Passo {step} de 3 — {step === 1 ? 'Seleção do Público' : step === 2 ? 'Criação do Script' : 'Regras de Segurança'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors">
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        {/* Conteúdo Central */}
        <div className="flex-1 overflow-y-auto p-8">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col gap-6"
              >
                <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 mb-4">
                    <h4 className="font-manrope font-black text-slate-800 mb-2">Quem receberá a mensagem?</h4>
                    <p className="text-sm font-bold text-slate-500">Selecione os contatos da sua base. Recomendamos disparos de no máximo 50 por vez para segurança.</p>
                </div>

                <div className="relative mb-4">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Filtrar por nome ou empresa..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-100/50 border border-slate-200 rounded-2xl py-4 pl-12 pr-6 text-sm font-bold focus:outline-none focus:ring-4 ring-primary/5 transition-all"
                  />
                </div>

                {loadingContacts ? <LoadingSpinner /> : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-8">
                    {filteredContacts.map(contact => (
                      <div 
                        key={contact.id}
                        onClick={() => toggleContact(contact.id)}
                        className={cn(
                          "p-4 rounded-2xl border transition-all cursor-pointer flex items-center gap-4 group",
                          selectedContacts.includes(contact.id) 
                            ? "bg-primary/10 border-primary shadow-lg shadow-primary/5" 
                            : "bg-white border-slate-100 hover:border-primary/30"
                        )}
                      >
                        <div className={cn(
                          "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
                          selectedContacts.includes(contact.id) ? "bg-primary border-primary text-white" : "border-slate-200"
                        )}>
                          {selectedContacts.includes(contact.id) && <Check className="w-4 h-4" />}
                        </div>
                        <Avatar name={contact.name} src={contact.avatar} size="sm" className="w-10 h-10" />
                        <div className="min-w-0">
                          <p className="text-sm font-black text-slate-800 truncate leading-none mb-1">{contact.name}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{contact.company}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {step === 2 && (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col gap-6"
              >
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Nome da Campanha</label>
                    <input 
                      type="text" 
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ex: Lançamento Produto X - Abril"
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 text-sm font-bold focus:outline-none focus:ring-4 ring-primary/5 mt-2"
                    />
                  </div>

                  <div className="relative">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Template da Mensagem</label>
                    <textarea 
                      value={formData.message_template}
                      onChange={(e) => setFormData(prev => ({ ...prev, message_template: e.target.value }))}
                      placeholder="Olá [Nome], como você está?"
                      rows={6}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 text-sm font-bold focus:outline-none focus:ring-4 ring-primary/5 mt-2 resize-none"
                    />
                    <div className="mt-4 flex flex-wrap gap-2">
                       <button onClick={() => insertVariable('[Nome]')} className="px-4 py-2 bg-slate-100 hover:bg-primary/10 text-slate-600 hover:text-primary rounded-xl text-[10px] font-black uppercase transition-all">Inserir [Nome]</button>
                       <button onClick={() => insertVariable('[Empresa]')} className="px-4 py-2 bg-slate-100 hover:bg-primary/10 text-slate-600 hover:text-primary rounded-xl text-[10px] font-black uppercase transition-all">Inserir [Empresa]</button>
                       <button onClick={() => insertVariable('{Olá|Oi|Bom dia}')} className="px-4 py-2 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-xl text-[10px] font-black uppercase transition-all">Usar Spintax {}</button>
                    </div>
                  </div>

                  <Card variant="glass" className="p-6 bg-amber-50/50 border-amber-200">
                    <div className="flex gap-4">
                      <Info className="w-5 h-5 text-amber-500 shrink-0" />
                      <p className="text-xs font-bold text-amber-700 leading-relaxed">
                        <span className="font-black">Dica Elite:</span> Use Spintax <span className="font-black bg-white px-1.5 py-0.5 rounded border border-amber-200">{'{A|B|C}'}</span> para que o WhatsApp receba mensagens variadas e não detecte o padrão robótico.
                      </p>
                    </div>
                  </Card>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div 
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col gap-8"
              >
                <div className="bg-emerald-500/10 p-8 rounded-[2.5rem] border border-emerald-500/20 flex items-center gap-6">
                   <div className="w-16 h-16 rounded-[2rem] bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
                      <ShieldCheck className="w-8 h-8" />
                   </div>
                   <div>
                      <h4 className="text-lg font-manrope font-black text-emerald-900 leading-tight">Configurações Anti-Ban</h4>
                      <p className="text-sm font-bold text-emerald-800/70">O sistema vai gerar um intervalo aleatório entre cada mensagem dentro da sua faixa de segurança.</p>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Tempo Mínimo (Segundos)</label>
                    <div className="flex items-center gap-4">
                      <input 
                        type="range" 
                        min="10" 
                        max="60" 
                        value={formData.min_delay}
                        onChange={(e) => setFormData(prev => ({ ...prev, min_delay: parseInt(e.target.value) }))}
                        className="flex-1 accent-primary" 
                      />
                      <span className="w-12 text-center text-sm font-black text-slate-800">{formData.min_delay}s</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Tempo Máximo (Segundos)</label>
                    <div className="flex items-center gap-4">
                      <input 
                        type="range" 
                        min="61" 
                        max="300" 
                        value={formData.max_delay}
                        onChange={(e) => setFormData(prev => ({ ...prev, max_delay: parseInt(e.target.value) }))}
                        className="flex-1 accent-primary" 
                      />
                      <span className="w-12 text-center text-sm font-black text-slate-800">{formData.max_delay}s</span>
                    </div>
                  </div>
                </div>

                <div className="mt-8 p-10 border-2 border-dashed border-slate-200 rounded-[2.5rem] text-center bg-slate-50/50">
                    <div className="inline-flex items-center gap-2 px-6 py-2 bg-white rounded-full border border-slate-100 shadow-sm mb-4">
                       <Users className="w-4 h-4 text-primary" />
                       <span className="text-xs font-black text-slate-800 font-inter uppercase tracking-widest">{selectedContacts.length} Contatos Selecionados</span>
                    </div>
                    <h3 className="text-2xl font-manrope font-black text-on-surface tracking-tighter">Sua campanha está pronta.</h3>
                    <p className="text-sm font-bold text-slate-500 mt-2">Clique no botão abaixo para salvar e iniciar o disparo controlado.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer com Navegação */}
        <div className="p-8 border-t border-slate-100 bg-white flex items-center justify-between">
          <div className="text-xs font-bold text-slate-400">
            {step > 1 && (
              <button 
                onClick={handleBack}
                className="flex items-center gap-2 hover:text-primary transition-all uppercase tracking-widest"
              >
                <ArrowLeft className="w-4 h-4" /> Voltar
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-xs font-black text-slate-300 uppercase tracking-widest mr-4">
              {selectedContacts.length} selecionados
            </span>
            {step < 3 ? (
              <Button 
                onClick={handleNext} 
                disabled={step === 1 && selectedContacts.length === 0}
                className="bg-primary text-white rounded-2xl px-8 flex items-center gap-2 font-black uppercase text-[10px] tracking-widest py-4"
              >
                Próximo Passo <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button 
                onClick={handleCreate} 
                disabled={isSaving}
                className="bg-emerald-500 text-white rounded-2xl px-10 flex items-center gap-2 font-black uppercase text-[10px] tracking-widest py-4 shadow-xl shadow-emerald-500/20"
              >
                {isSaving ? <LoadingSpinner size="sm" /> : <><Check className="w-5 h-5" /> Criar e Iniciar Campanha</>}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
