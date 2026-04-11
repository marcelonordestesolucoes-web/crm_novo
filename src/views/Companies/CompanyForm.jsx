import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui';
import { createCompany, updateCompany } from '@/services/companies';
import { formatCpfCnpj } from '@/utils/masks';

export const CompanyForm = ({ initialData, onSuccess, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    sector: '',
    tax_id: '',
    stage: 'Lead Bruto',
    score: 50,
  });

  useEffect(() => {
    if (initialData) {
      // Map initial UI structure back to what DB expects (if slightly different) or just populate
      setFormData({
        name: initialData.name || '',
        sector: initialData.sector || '',
        tax_id: initialData.taxId || '',
        stage: initialData.stage || 'Lead Bruto',
        score: initialData.score || 50,
      });
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (initialData?.id) {
        await updateCompany(initialData.id, formData);
      } else {
        await createCompany(formData);
      }
      onSuccess();
    } catch (err) {
      console.error('Error saving company:', err);
      setError(err.message || 'Erro ao salvar a empresa.');
      setLoading(false);
    }
  };

  return (
    <form id="company-form" onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="p-3 text-sm text-error bg-error/10 border border-error/20 rounded-xl font-medium">
          {error}
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Company Name</label>
        <input
          type="text"
          name="name"
          required
          value={formData.name}
          onChange={handleChange}
          className="w-full text-sm font-inter text-on-surface py-3 px-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          placeholder="Ex: Microsoft Corp."
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">CNPJ / Tax ID</label>
        <input
          type="text"
          name="tax_id"
          value={formData.tax_id}
          onChange={(e) => setFormData((prev) => ({ ...prev, tax_id: formatCpfCnpj(e.target.value) }))}
          className="w-full text-sm font-inter text-on-surface py-3 px-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          placeholder="00.000.000/0001-00"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Sector</label>
        <input
          type="text"
          name="sector"
          value={formData.sector}
          onChange={handleChange}
          className="w-full text-sm font-inter text-on-surface py-3 px-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          placeholder="Technology"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Stage</label>
          <select
            name="stage"
            value={formData.stage}
            onChange={handleChange}
            className="w-full text-sm font-inter text-on-surface py-3 px-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white"
          >
            <option value="Lead Bruto">Lead Bruto</option>
            <option value="Qualificação">Qualificação</option>
            <option value="Cliente Ativo">Cliente Ativo</option>
            <option value="Em Risco">Em Risco</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Health Score</label>
          <input
            type="number"
            name="score"
            min="0"
            max="100"
            required
            value={formData.score}
            onChange={handleChange}
            className="w-full text-sm font-inter text-on-surface py-3 px-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>
      </div>
      
      {/* Invisible submit button to allow Enter to submit, although the SlideOver footer is where the visual button lives. */}
      {/* Alternatively, we let SlideOver trigger the form via document.getElementById */}
    </form>
  );
};
