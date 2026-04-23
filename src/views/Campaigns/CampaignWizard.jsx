// src/views/Campaigns/CampaignWizard.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  FileSpreadsheet,
  Info,
  MessageSquare,
  Search,
  ShieldCheck,
  Upload,
  Users,
  X,
  Zap
} from 'lucide-react';
import { Avatar, Button, LoadingSpinner, Modal } from '@/components/ui';
import { getContacts } from '@/services/contacts';
import {
  buildDispatchQueue,
  createCampaignContacts,
  createCampaignDraft,
  createCampaignImport,
  updateCampaignDraft
} from '@/services/campaigns';
import { parseCampaignFile } from '@/utils/campaignImport';
import { useSupabase } from '@/hooks/useSupabase';
import { cn } from '@/lib/utils';

const stepLabels = ['Dados', 'Publico', 'Mensagem', 'Seguranca', 'Revisao'];

const initialForm = {
  name: '',
  description: '',
  source_type: 'crm',
  whatsapp_instance_id: 'default',
  message_template: '',
  message_variants: [''],
  min_delay_seconds: 30,
  max_delay_seconds: 90,
  per_minute_limit: 5,
  per_hour_limit: 60,
  cooldown_hours: 72,
  start_time: '08:00',
  end_time: '18:00',
  timezone: 'America/Sao_Paulo',
  require_opt_in: true,
  block_recent_interactions: true,
  recent_interaction_hours: 24,
  safe_mode_enabled: true
};

const errorLabels = {
  missing_name: 'Nome ausente',
  invalid_phone: 'Telefone invalido',
  duplicate_phone: 'Telefone duplicado',
  missing_opt_in: 'Sem opt-in'
};

function formFromCampaign(campaign) {
  if (!campaign) return initialForm;
  return {
    ...initialForm,
    name: campaign.name || '',
    description: campaign.description || '',
    source_type: campaign.source_type || 'crm',
    whatsapp_instance_id: campaign.whatsapp_instance_id || 'default',
    message_template: campaign.message_template || '',
    message_variants: Array.isArray(campaign.message_variants) && campaign.message_variants.length
      ? campaign.message_variants
      : [''],
    min_delay_seconds: campaign.min_delay_seconds || campaign.min_delay || 30,
    max_delay_seconds: campaign.max_delay_seconds || campaign.max_delay || 90,
    per_minute_limit: campaign.per_minute_limit || 5,
    per_hour_limit: campaign.per_hour_limit || 60,
    cooldown_hours: campaign.cooldown_hours || 72,
    start_time: campaign.start_time || '08:00',
    end_time: campaign.end_time || '18:00',
    timezone: campaign.timezone || 'America/Sao_Paulo',
    require_opt_in: campaign.require_opt_in ?? true,
    block_recent_interactions: campaign.block_recent_interactions ?? true,
    recent_interaction_hours: campaign.recent_interaction_hours || 24,
    safe_mode_enabled: campaign.safe_mode_enabled ?? true
  };
}

export default function CampaignWizard({ isOpen, onClose, onCreated, campaignToEdit = null }) {
  const [step, setStep] = useState(1);
  const { data: contacts, loading: loadingContacts } = useSupabase(getContacts);
  const [selectedContactIds, setSelectedContactIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState(initialForm);
  const [importPreview, setImportPreview] = useState(null);
  const [importFile, setImportFile] = useState(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isEditing = Boolean(campaignToEdit?.id);

  useEffect(() => {
    if (!isOpen) return;
    setFormData(formFromCampaign(campaignToEdit));
    setStep(1);
    setSelectedContactIds([]);
    setSearchQuery('');
    setImportPreview(null);
    setImportFile(null);
  }, [campaignToEdit, isOpen]);

  const filteredContacts = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return (contacts || []).filter((contact) =>
      contact.name?.toLowerCase().includes(query) ||
      contact.company?.toLowerCase().includes(query) ||
      contact.phone?.toLowerCase().includes(query)
    );
  }, [contacts, searchQuery]);

  const selectedCrmContacts = useMemo(() => {
    const selected = new Set(selectedContactIds);
    return (contacts || []).filter((contact) => selected.has(contact.id));
  }, [contacts, selectedContactIds]);

  const importedValidRows = importPreview?.validRows || [];
  const importedInvalidRows = importPreview?.invalidRows || [];
  const totalAudience = selectedCrmContacts.length + importedValidRows.length;
  const eligibleAudience = totalAudience;
  const blockedAudience = importedInvalidRows.length;
  const estimatedSeconds = eligibleAudience * ((Number(formData.min_delay_seconds) + Number(formData.max_delay_seconds)) / 2);

  const reset = () => {
    setStep(1);
    setSelectedContactIds([]);
    setSearchQuery('');
    setFormData(initialForm);
    setImportPreview(null);
    setImportFile(null);
    setIsParsing(false);
    setIsSaving(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const toggleContact = (id) => {
    setSelectedContactIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updateVariant = (index, value) => {
    setFormData((prev) => ({
      ...prev,
      message_variants: prev.message_variants.map((variant, currentIndex) =>
        currentIndex === index ? value : variant
      )
    }));
  };

  const addVariant = () => {
    setFormData((prev) => ({
      ...prev,
      message_variants: prev.message_variants.length >= 5
        ? prev.message_variants
        : [...prev.message_variants, '']
    }));
  };

  const removeVariant = (index) => {
    setFormData((prev) => ({
      ...prev,
      message_variants: prev.message_variants.filter((_, currentIndex) => currentIndex !== index)
    }));
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsParsing(true);
      const preview = await parseCampaignFile(file);
      setImportFile(file);
      setImportPreview(preview);
      updateField('source_type', selectedContactIds.length > 0 ? 'mixed' : 'excel');
    } catch (error) {
      console.error('Erro ao importar planilha:', error);
      alert(error.message || 'Nao foi possivel ler a planilha.');
    } finally {
      setIsParsing(false);
      event.target.value = '';
    }
  };

  const canGoNext = () => {
    if (step === 1) return formData.name.trim().length > 0;
    if (step === 2) return isEditing || totalAudience > 0;
    if (step === 3) return formData.message_template.trim().length > 0;
    if (step === 4) return Number(formData.max_delay_seconds) >= Number(formData.min_delay_seconds);
    return true;
  };

  const handleCreateDraft = async () => {
    if (!formData.name.trim() || !formData.message_template.trim() || (!isEditing && totalAudience === 0)) {
      alert('Preencha campanha, mensagem e publico antes de salvar.');
      return;
    }

    try {
      setIsSaving(true);
      if (isEditing) {
        await updateCampaignDraft(campaignToEdit.id, {
          ...formData,
          message_variants: formData.message_variants.map((variant) => variant.trim()).filter(Boolean)
        });
        await onCreated?.();
        handleClose();
        return;
      }

      const campaign = await createCampaignDraft({
        ...formData,
        source_type: selectedContactIds.length > 0 && importedValidRows.length > 0
          ? 'mixed'
          : importedValidRows.length > 0 ? 'excel' : 'crm',
        message_variants: formData.message_variants.map((variant) => variant.trim()).filter(Boolean)
      });

      let importRecord = null;
      if (importFile && importPreview) {
        importRecord = await createCampaignImport({
          campaign_id: campaign.id,
          filename: importFile.name,
          file_type: importFile.type || importFile.name.split('.').pop(),
          file_size_bytes: importFile.size,
          source_type: 'excel',
          total_rows: importPreview.totalRows,
          valid_rows: importPreview.validRows.length,
          invalid_rows: importPreview.invalidRows.length,
          duplicate_rows: importPreview.duplicateRows.length,
          imported_rows: importPreview.validRows.length,
          error_report: importPreview.invalidRows.map((row) => ({
            row_number: row.row_number,
            phone: row.imported_phone,
            errors: row.validation_errors
          }))
        });
      }

      const crmRows = selectedCrmContacts.map((contact) => ({
        contact_id: contact.id,
        imported_name: contact.name,
        imported_phone: contact.phone,
        company_name: contact.company,
        email: contact.email,
        source: 'crm',
        opt_in: true
      }));

      const importedRows = importedValidRows.map((row) => ({
        ...row,
        import_id: importRecord?.id || null,
        opt_in: formData.require_opt_in ? row.opt_in : true
      }));

      await createCampaignContacts(campaign.id, [...crmRows, ...importedRows]);
      await buildDispatchQueue(campaign.id);

      await onCreated?.();
      handleClose();
    } catch (error) {
      console.error('Erro ao salvar campanha:', error);
      alert(error.message || 'Erro ao salvar campanha.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={null} className="max-w-6xl w-full">
      <div className="flex flex-col h-[84vh]">
        <div className="p-8 border-b border-slate-100 bg-primary/5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-manrope font-black text-slate-800 leading-none">
                {isEditing ? 'Editar Campanha' : 'Campanha Blindada'}
              </h3>
              <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mt-1">
                Etapa {step} de 5 - {stepLabels[step - 1]}
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-white rounded-full transition-colors">
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        <div className="px-8 pt-6">
          <div className="grid grid-cols-5 gap-3">
            {stepLabels.map((label, index) => (
              <div key={label} className="space-y-2">
                <div className={cn(
                  'h-2 rounded-full transition-all',
                  step >= index + 1 ? 'bg-primary' : 'bg-slate-100'
                )} />
                <p className={cn(
                  'text-[9px] font-black uppercase tracking-widest',
                  step >= index + 1 ? 'text-primary' : 'text-slate-300'
                )}>
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <StepPanel key="basic">
                <SectionTitle icon={Info} title="Dados basicos" subtitle={isEditing ? 'Atualize dados, mensagem e regras de seguranca.' : 'Crie a campanha em modo rascunho. Nenhum disparo sera feito.'} />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Field label="Nome da campanha">
                    <input
                      value={formData.name}
                      onChange={(event) => updateField('name', event.target.value)}
                      className="field-input"
                      placeholder="Ex: Reativacao de leads - Maio"
                    />
                  </Field>
                  <Field label="Instancia WhatsApp">
                    <input
                      value={formData.whatsapp_instance_id}
                      onChange={(event) => updateField('whatsapp_instance_id', event.target.value)}
                      className="field-input"
                      placeholder="default"
                    />
                  </Field>
                  <Field label="Descricao" className="lg:col-span-2">
                    <textarea
                      value={formData.description}
                      onChange={(event) => updateField('description', event.target.value)}
                      className="field-input min-h-[110px] resize-none"
                      placeholder="Objetivo da campanha, publico e contexto comercial."
                    />
                  </Field>
                </div>
              </StepPanel>
            )}

            {step === 2 && (
              <StepPanel key="audience">
                <SectionTitle icon={Users} title="Publico" subtitle={isEditing ? 'A audiencia existente sera preservada nesta edicao.' : 'Selecione contatos do CRM, importe planilha ou combine as duas fontes.'} />
                {isEditing && (
                  <div className="p-5 rounded-[2rem] bg-amber-50 border border-amber-100 text-amber-700 text-sm font-bold">
                    Para preservar historico e evitar duplicidade, a edicao altera configuracoes e mensagem. Para trocar a audiencia, crie uma nova campanha.
                  </div>
                )}
                {!isEditing && <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                  <div className="space-y-5">
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Buscar contato do CRM..."
                        className="field-input pl-11"
                      />
                    </div>
                    <div className="max-h-[360px] overflow-y-auto pr-2 space-y-3">
                      {loadingContacts ? <LoadingSpinner /> : filteredContacts.map((contact) => (
                        <button
                          type="button"
                          key={contact.id}
                          onClick={() => toggleContact(contact.id)}
                          className={cn(
                            'w-full p-4 rounded-2xl border transition-all flex items-center gap-4 text-left',
                            selectedContactIds.includes(contact.id)
                              ? 'bg-primary/10 border-primary shadow-lg shadow-primary/5'
                              : 'bg-white border-slate-100 hover:border-primary/30'
                          )}
                        >
                          <div className={cn(
                            'w-6 h-6 rounded-lg border-2 flex items-center justify-center',
                            selectedContactIds.includes(contact.id) ? 'bg-primary border-primary text-white' : 'border-slate-200'
                          )}>
                            {selectedContactIds.includes(contact.id) && <Check className="w-4 h-4" />}
                          </div>
                          <Avatar name={contact.name} src={contact.avatar} size="sm" className="w-10 h-10" />
                          <div className="min-w-0">
                            <p className="text-sm font-black text-slate-800 truncate">{contact.name}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{contact.phone} - {contact.company}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <a
                        href="/templates/campanha-whatsapp-modelo.xlsx"
                        download
                        className="flex-1 px-4 py-3 rounded-2xl bg-white border border-primary/20 text-primary hover:bg-primary hover:text-white transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest"
                      >
                        <Download className="w-4 h-4" />
                        Baixar modelo XLSX
                      </a>
                      <a
                        href="/templates/campanha-whatsapp-modelo.csv"
                        download
                        className="px-4 py-3 rounded-2xl bg-white border border-slate-200 text-slate-500 hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest"
                      >
                        CSV
                      </a>
                    </div>

                    <label className="block border-2 border-dashed border-primary/20 bg-primary/5 rounded-[2rem] p-8 text-center cursor-pointer hover:bg-primary/10 transition-all">
                      <Upload className="w-10 h-10 text-primary mx-auto mb-4" />
                      <p className="font-manrope font-black text-slate-800">Importar CSV/XLSX</p>
                      <p className="text-xs font-bold text-slate-400 mt-2">O arquivo sera usado na campanha sem poluir o CRM.</p>
                      <input type="file" className="hidden" accept=".csv,.xlsx,.xls" onChange={handleFileChange} />
                    </label>

                    {isParsing && <LoadingSpinner />}
                    {importPreview && (
                      <div className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden">
                        <div className="p-5 grid grid-cols-4 gap-3 border-b border-slate-100">
                          <MiniStat label="Linhas" value={importPreview.totalRows} />
                          <MiniStat label="Validos" value={importPreview.validRows.length} tone="success" />
                          <MiniStat label="Invalidos" value={importPreview.invalidRows.length} tone="danger" />
                          <MiniStat label="Duplicados" value={importPreview.duplicateRows.length} tone="warning" />
                        </div>
                        <div className="max-h-[250px] overflow-y-auto">
                          {importPreview.rows.slice(0, 20).map((row) => (
                            <div key={row.row_number} className="px-5 py-3 border-b border-slate-50 flex items-center justify-between gap-4">
                              <div className="min-w-0">
                                <p className="text-sm font-black text-slate-700 truncate">{row.imported_name || 'Sem nome'}</p>
                                <p className="text-[10px] font-bold text-slate-400 truncate">{row.normalized_phone || row.imported_phone || 'Sem telefone'}</p>
                              </div>
                              <span className={cn(
                                'text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full',
                                row.is_valid ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                              )}>
                                {row.is_valid ? 'Valido' : (errorLabels[row.block_reason] || 'Bloqueado')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>}
              </StepPanel>
            )}

            {step === 3 && (
              <StepPanel key="message">
                <SectionTitle icon={MessageSquare} title="Mensagem" subtitle="Prepare o template e ate 5 variacoes para humanizacao futura." />
                <Field label="Template principal">
                  <textarea
                    value={formData.message_template}
                    onChange={(event) => updateField('message_template', event.target.value)}
                    className="field-input min-h-[150px] resize-none"
                    placeholder="Ola {primeiro_nome}, tudo bem?"
                  />
                </Field>
                <div className="flex flex-wrap gap-2">
                  {['{nome}', '{primeiro_nome}', '{empresa}', '{cidade}'].map((variable) => (
                    <button
                      type="button"
                      key={variable}
                      onClick={() => updateField('message_template', `${formData.message_template}${variable}`)}
                      className="px-4 py-2 bg-primary/10 text-primary rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all"
                    >
                      {variable}
                    </button>
                  ))}
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Variacoes opcionais</p>
                    <button type="button" onClick={addVariant} className="text-[10px] font-black text-primary uppercase tracking-widest">Adicionar variacao</button>
                  </div>
                  {formData.message_variants.map((variant, index) => (
                    <div key={index} className="flex gap-3">
                      <input
                        value={variant}
                        onChange={(event) => updateVariant(index, event.target.value)}
                        className="field-input"
                        placeholder={`Variacao ${index + 1}`}
                      />
                      {formData.message_variants.length > 1 && (
                        <button type="button" onClick={() => removeVariant(index)} className="px-4 rounded-2xl bg-rose-50 text-rose-500 font-black text-xs">Remover</button>
                      )}
                    </div>
                  ))}
                </div>
              </StepPanel>
            )}

            {step === 4 && (
              <StepPanel key="safety">
                <SectionTitle icon={ShieldCheck} title="Seguranca operacional" subtitle="Essas regras serao usadas pela fila da Etapa 2. Agora ficam salvas no draft." />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <NumberField label="Delay minimo (seg)" value={formData.min_delay_seconds} onChange={(value) => updateField('min_delay_seconds', value)} />
                  <NumberField label="Delay maximo (seg)" value={formData.max_delay_seconds} onChange={(value) => updateField('max_delay_seconds', value)} />
                  <NumberField label="Limite por minuto" value={formData.per_minute_limit} onChange={(value) => updateField('per_minute_limit', value)} />
                  <NumberField label="Limite por hora" value={formData.per_hour_limit} onChange={(value) => updateField('per_hour_limit', value)} />
                  <NumberField label="Cooldown por contato (h)" value={formData.cooldown_hours} onChange={(value) => updateField('cooldown_hours', value)} />
                  <NumberField label="Bloquear interacao recente (h)" value={formData.recent_interaction_hours} onChange={(value) => updateField('recent_interaction_hours', value)} />
                  <Field label="Inicio da janela">
                    <input type="time" value={formData.start_time} onChange={(event) => updateField('start_time', event.target.value)} className="field-input" />
                  </Field>
                  <Field label="Fim da janela">
                    <input type="time" value={formData.end_time} onChange={(event) => updateField('end_time', event.target.value)} className="field-input" />
                  </Field>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Toggle label="Exigir opt-in" checked={formData.require_opt_in} onChange={(value) => updateField('require_opt_in', value)} />
                  <Toggle label="Modo seguro" checked={formData.safe_mode_enabled} onChange={(value) => updateField('safe_mode_enabled', value)} />
                  <Toggle label="Bloquear recentes" checked={formData.block_recent_interactions} onChange={(value) => updateField('block_recent_interactions', value)} />
                </div>
              </StepPanel>
            )}

            {step === 5 && (
              <StepPanel key="review">
                <SectionTitle icon={FileSpreadsheet} title="Revisao" subtitle={isEditing ? 'As alteracoes serao aplicadas na campanha existente.' : 'Nada sera enviado agora. A campanha sera salva como rascunho e a fila ficara pendente.'} />
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <ReviewCard label="CRM" value={isEditing ? campaignToEdit?.total_contacts || 0 : selectedCrmContacts.length} />
                  <ReviewCard label="Planilha valida" value={isEditing ? campaignToEdit?.total_eligible || 0 : importedValidRows.length} />
                  <ReviewCard label="Bloqueados" value={isEditing ? campaignToEdit?.total_blocked_by_rule || 0 : blockedAudience} tone="danger" />
                  <ReviewCard label="Duracao estimada" value={`${Math.ceil(estimatedSeconds / 60)} min`} />
                </div>
                <div className="p-6 bg-slate-50 border border-slate-100 rounded-[2rem]">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Resumo</p>
                  <h4 className="text-2xl font-manrope font-black text-slate-900">{formData.name}</h4>
                  <p className="mt-3 text-sm font-bold text-slate-500 whitespace-pre-wrap">{formData.message_template}</p>
                </div>
              </StepPanel>
            )}
          </AnimatePresence>
        </div>

        <div className="p-8 border-t border-slate-100 bg-white flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep((current) => Math.max(1, current - 1))}
            disabled={step === 1}
            className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest disabled:opacity-20 hover:text-primary transition-all"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>

          <div className="flex items-center gap-4">
            <span className="text-xs font-black text-slate-300 uppercase tracking-widest">
              {isEditing ? `${campaignToEdit?.total_eligible || 0} elegiveis` : `${eligibleAudience} elegiveis`}
            </span>
            {step < 5 ? (
              <Button
                onClick={() => setStep((current) => current + 1)}
                disabled={!canGoNext()}
                className="bg-primary text-white rounded-2xl px-8 flex items-center gap-2 font-black uppercase text-[10px] tracking-widest py-4"
              >
                Proximo <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                onClick={handleCreateDraft}
                disabled={isSaving}
                className="bg-emerald-500 text-white rounded-2xl px-10 flex items-center gap-2 font-black uppercase text-[10px] tracking-widest py-4 shadow-xl shadow-emerald-500/20"
              >
                {isSaving ? <LoadingSpinner size="sm" /> : <><Check className="w-5 h-5" /> {isEditing ? 'Salvar alteracoes' : 'Salvar rascunho'}</>}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function StepPanel({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8"
    >
      {children}
    </motion.div>
  );
}

function SectionTitle({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <h4 className="text-xl font-manrope font-black text-slate-900">{title}</h4>
        <p className="text-sm font-bold text-slate-400">{subtitle}</p>
      </div>
    </div>
  );
}

function Field({ label, className, children }) {
  return (
    <label className={cn('space-y-2 block', className)}>
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">{label}</span>
      {children}
    </label>
  );
}

function NumberField({ label, value, onChange }) {
  return (
    <Field label={label}>
      <input type="number" min="0" value={value} onChange={(event) => onChange(Number(event.target.value))} className="field-input" />
    </Field>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        'p-4 rounded-2xl border flex items-center justify-between gap-4 transition-all',
        checked ? 'bg-primary/10 border-primary text-primary' : 'bg-white border-slate-100 text-slate-400'
      )}
    >
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
      <span className={cn('w-10 h-6 rounded-full p-1 transition-all', checked ? 'bg-primary' : 'bg-slate-200')}>
        <span className={cn('block w-4 h-4 bg-white rounded-full transition-all', checked && 'translate-x-4')} />
      </span>
    </button>
  );
}

function MiniStat({ label, value, tone }) {
  const colors = {
    success: 'text-emerald-600',
    danger: 'text-rose-600',
    warning: 'text-amber-600'
  };

  return (
    <div>
      <p className={cn('text-lg font-manrope font-black text-slate-900', colors[tone])}>{value}</p>
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
    </div>
  );
}

function ReviewCard({ label, value, tone }) {
  return (
    <div className="p-6 bg-white border border-slate-100 rounded-[2rem] shadow-sm">
      <p className={cn('text-3xl font-manrope font-black text-slate-900', tone === 'danger' && 'text-rose-500')}>{value}</p>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">{label}</p>
    </div>
  );
}
