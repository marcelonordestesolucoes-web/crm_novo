import React from 'react';
import { MoreVertical, Star } from 'lucide-react';
import { Badge, Button, Card, PageHeader, SearchBar, LoadingSpinner, ErrorMessage, Avatar } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useSearch } from '@/hooks/useSearch';
import { useSupabase } from '@/hooks/useSupabase';
import { getCompanies, deleteCompany } from '@/services/companies';
import { getHealthScoreStyle, COMPANY_STAGE } from '@/constants/config';
import { SlideOver } from '@/components/ui';
import { CompanyForm } from './CompanyForm';

const CompanyRow = ({ company, onEdit, onDelete }) => {
  const scoreStyle = getHealthScoreStyle(company.score);
  const stageConfig = COMPANY_STAGE[company.stage] ?? {};
  const [showOptions, setShowOptions] = React.useState(false);

  return (
    <Card variant="glass" className="p-8 group relative overflow-hidden transition-all duration-500 hover:-translate-y-1 hover:scale-[1.005] hover:shadow-[0_20px_50px_rgba(0,0,0,0.05)]">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/0 to-primary/[0.02] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      <div className="flex items-center gap-8 relative z-10">
        {/* Logo - Styled */}
        <div className="w-20 h-20 rounded-3xl bg-white/60 flex items-center justify-center overflow-hidden shrink-0 border-2 border-white transition-all group-hover:scale-105 shadow-sm">
          <img src={company.logo} alt={company.name} className="w-12 h-12 object-contain" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-4 mb-2 flex-wrap">
            <h3 className="font-manrope font-black text-2xl text-on-surface tracking-tight group-hover:text-primary transition-colors truncate">
              {company.name}
            </h3>
            <Badge variant={stageConfig.variant} className={cn("px-4 py-1.5 rounded-full text-[10px] uppercase font-black tracking-widest border border-white/40", stageConfig.badgeClass)} label={company.stage} />
          </div>
          <div className="flex items-center gap-6 text-[11px] text-slate-500 font-bold uppercase tracking-widest opacity-60">
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base">business</span>
              {company.sector}
            </span>
            <span>ID: {company.taxId}</span>
          </div>
        </div>

        {/* Health Score - Glass Integrated */}
        <div className="hidden lg:flex flex-col items-center px-10 border-x border-white/20">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2 opacity-60">Account Health</p>
          <div className="flex items-center gap-3">
            <span className={`text-3xl font-manrope font-black ${scoreStyle.text} tracking-tighter`}>{company.score}</span>
            <div className={cn("w-3 h-3 rounded-full animate-pulse", scoreStyle.bg)} />
          </div>
        </div>

        {/* Owner */}
        <div className="flex items-center gap-6 pl-8">
          <div className="text-right hidden xl:block leading-tight">
            <p className="text-sm font-manrope font-black text-on-surface tracking-tight">{company.responsible}</p>
            <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest opacity-60">
              {company.responsiblePosition}
            </p>
          </div>
          <Avatar 
            src={company.responsibleAvatar} 
            name={company.responsible} 
            size="md"
            className="w-12 h-12 border-white/80 shadow-md group-hover:-rotate-6"
          />
          
          <div className="relative">
            <button 
              onClick={() => setShowOptions(!showOptions)}
              className="w-10 h-10 rounded-2xl bg-white/20 hover:bg-white text-on-surface-variant transition-all border border-white/60 shadow-sm flex items-center justify-center"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            {showOptions && (
              <div className="absolute right-0 top-12 w-56 bg-white/90 backdrop-blur-xl rounded-[1.5rem] shadow-2xl border border-white/40 z-[100] py-3 animate-in fade-in zoom-in-95 duration-200">
                <button 
                  onClick={() => { setShowOptions(false); onEdit(company); }}
                  className="w-full text-left px-6 py-3 hover:bg-primary/5 text-sm font-black font-manrope text-slate-700 transition-colors flex items-center gap-3"
                >
                  <span className="material-symbols-outlined text-lg opacity-40">edit</span>
                  Editar Conta
                </button>
                <div className="h-px bg-slate-100 mx-4 my-1" />
                <button 
                  onClick={() => {
                    setShowOptions(false);
                    if (window.confirm('Tem certeza que deseja remover esta conta estratégica?')) {
                      onDelete(company.id);
                    }
                  }}
                  className="w-full text-left px-6 py-3 hover:bg-red-50 text-sm font-black font-manrope text-red-600 transition-colors flex items-center gap-3"
                >
                  <span className="material-symbols-outlined text-lg opacity-40 text-red-400">delete</span>
                  Remover Conta
                </button>
              </div>
            )}
            
            {showOptions && (
              <div className="fixed inset-0 z-0" onClick={() => setShowOptions(false)} />
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default function Companies() {
  const { data, loading, error, refetch } = useSupabase(getCompanies);
  const companies = data || [];
  const { query, setQuery, filtered } = useSearch(companies, ['name', 'sector', 'taxId']);

  const [slideOpen, setSlideOpen] = React.useState(false);
  const [editingCompany, setEditingCompany] = React.useState(null);

  const handleOpenCreate = () => {
    setEditingCompany(null);
    setSlideOpen(true);
  };

  const handleOpenEdit = (company) => {
    setEditingCompany(company);
    setSlideOpen(true);
  };

  const handleDelete = async (id) => {
    try {
      await deleteCompany(id);
      refetch();
    } catch (err) {
      alert('Error deleting company: ' + err.message);
    }
  };

  const handleSuccess = () => {
    setSlideOpen(false);
    refetch();
  };

  return (
    <div className="animate-in fade-in duration-700 max-w-7xl mx-auto w-full relative -mt-10 z-10">
      {/* Aurora Spotlight — Foco de Produto no Portfólio */}
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[900px] h-[450px] bg-emerald-400/[0.06] blur-[130px] rounded-full pointer-events-none -z-10" />

      <PageHeader
        title="Portfólio Estratégico"
        subtitle={`Gerenciando ${companies.length} contas-chave com supervisão estratégica.`}
        actions={<Button icon="add" onClick={handleOpenCreate}>Adicionar Empresa</Button>}
      />

      <div className="flex items-center gap-4 bg-white/70 backdrop-blur-2xl p-3 rounded-[2rem] border border-white/40 mb-10 shadow-[0_10px_40px_rgba(0,0,0,0.05)] ring-1 ring-emerald-500/10 transition-all duration-500 hover:shadow-lg">
        <SearchBar
          placeholder="Buscar no portfólio estratégico..."
          value={query}
          onChange={setQuery}
          className="bg-transparent border-0 shadow-none focus-within:ring-0"
        />
        <button className="w-12 h-12 rounded-2xl border border-white/60 bg-white/50 hover:bg-white text-slate-400 hover:text-primary transition-all flex items-center justify-center shadow-sm active:scale-95">
          <span className="material-symbols-outlined">filter_list</span>
        </button>
      </div>

      {loading && <LoadingSpinner message="Carregando empresas..." />}
      {error   && <ErrorMessage message={error} onRetry={refetch} />}

      {!loading && !error && (
        <div className="grid grid-cols-1 gap-4">
          {filtered.length > 0 ? (
            filtered.map((company) => (
              <CompanyRow 
                key={company.id} 
                company={company} 
                onEdit={handleOpenEdit}
                onDelete={handleDelete}
              />
            ))
          ) : (
            <div className="text-center py-20 text-on-surface-variant font-inter">
              {query ? (
                <>Nenhuma empresa encontrada para "<span className="font-bold">{query}</span>".</>
              ) : (
                <>Seu portfólio estratégico está vazio. Clique em <span className="text-primary font-bold">Adicionar Empresa</span> para começar.</>
              )}
            </div>
          )}
        </div>
      )}

      {/* CRUD Slide Over */}
      <SlideOver
        isOpen={slideOpen}
        onClose={() => setSlideOpen(false)}
        title={editingCompany ? 'Edit Company' : 'New Company'}
        description={editingCompany ? 'Update the details for this key account.' : 'Create a new key account.'}
        footer={
          <>
            <button 
              onClick={() => setSlideOpen(false)}
              className="px-5 py-2.5 rounded-xl font-bold font-inter text-slate-500 hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={() => document.getElementById('company-form').requestSubmit()}
              className="px-5 py-2.5 rounded-xl font-bold font-inter bg-navy hover:bg-navy-light text-white transition-colors"
            >
              {editingCompany ? 'Save Changes' : 'Create Company'}
            </button>
          </>
        }
      >
        <CompanyForm 
          initialData={editingCompany} 
          onSuccess={handleSuccess} 
          onCancel={() => setSlideOpen(false)} 
        />
      </SlideOver>
    </div>
  );
}
