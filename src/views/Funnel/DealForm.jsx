import React, { useState, useEffect } from 'react';
import { PlusCircle, Trash2 } from 'lucide-react';
import { createDeal, updateDeal } from '@/services/deals';
import { formatCpfCnpj, formatPhone } from '@/utils/masks';

const LEAD_SOURCES = [
  'Prospecção App', 'Prospecção Call', 'Whatsapp', 'Instagram', 
  'Tik Tok', 'Google', 'Site', 'Feira e Eventos'
];

export const DealForm = ({ initialData, onSuccess, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [formData, setFormData] = useState({
    title: '',
    company: '',
    taxId: '',
    segment: '',
    leadSource: LEAD_SOURCES[0],
    products: [],
    totalValue: 0,
    contacts: [{ name: '', role: '', phone: '', email: '' }],
    stage: 'lead',
    status: 'new'
  });

  useEffect(() => {
    if (initialData) {
      const initialProducts = initialData.products || [];
      const calculatedTotal = initialProducts.reduce((sum, p) => sum + Number(p.price || 0), 0);
      
      setFormData({
        title: initialData.title || '',
        company: initialData.company || '',
        taxId: initialData.taxId || '',
        segment: initialData.segment || '',
        leadSource: initialData.leadSource || LEAD_SOURCES[0],
        products: initialProducts,
        totalValue: calculatedTotal || initialData.value || 0,
        contacts: initialData.contacts?.length ? initialData.contacts : 
                  [{ name: '', role: '', phone: '', email: '' }],
        stage: initialData.stage || 'lead',
        status: initialData.status || 'new',
      });
    } else {
      // Reset completo se não houver data (Fallback de segurança)
      setFormData({
        title: '',
        company: '',
        taxId: '',
        segment: '',
        leadSource: LEAD_SOURCES[0],
        products: [],
        totalValue: 0,
        contacts: [{ name: '', role: '', phone: '', email: '' }],
        stage: 'lead',
        status: 'new'
      });
    }
  }, [initialData]);

  const addProduct = () => {
    setFormData({
      ...formData,
      products: [...(formData.products || []), { name: '', price: 0 }]
    });
  };

  const removeProduct = (index) => {
    const newProducts = [...(formData.products || [])];
    newProducts.splice(index, 1);
    const newTotal = newProducts.reduce((sum, p) => sum + Number(p.price), 0);
    setFormData({ ...formData, products: newProducts, totalValue: newTotal });
  };

  const updateProduct = (index, field, value) => {
    const newProducts = [...(formData.products || [])];
    newProducts[index] = { ...newProducts[index], [field]: value };
    const newTotal = newProducts.reduce((sum, p) => sum + Number(p.price), 0);
    setFormData({ ...formData, products: newProducts, totalValue: newTotal });
  };

  const addContact = () => {
    setFormData({
      ...formData,
      contacts: [...(formData.contacts || []), { name: '', role: '', phone: '', email: '' }]
    });
  };

  const removeContact = (index) => {
    const newContacts = [...(formData.contacts || [])];
    newContacts.splice(index, 1);
    setFormData({ ...formData, contacts: newContacts });
  };

  const updateContact = (index, field, value) => {
    const newContacts = [...(formData.contacts || [])];
    newContacts[index] = { ...newContacts[index], [field]: value };
    setFormData({ ...formData, contacts: newContacts });
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setLoading(true);
    setError(null);

    const dealPayload = {
      ...formData,
      value: formData.totalValue, 
      is_qualified: true
    };

    try {
      let savedDeal;
      if (initialData?.id) {
        savedDeal = await updateDeal(initialData.id, dealPayload);
      } else {
        savedDeal = await createDeal(dealPayload);
      }
      onSuccess(savedDeal);
    } catch (err) {
      console.error('Error saving deal:', err);
      // Supabase errors are often objects { message, details, code }
      const errorMsg = err?.message || err?.details || JSON.stringify(err);
      setError(`Erro ao salvar: ${errorMsg}`);
      setLoading(false);
    }
  };

  // Used to bind external button if needed, but since user requested footer buttons, 
  // we'll place the submit button inside the form bottom or bind by ID.
  return (
    <form id="deal-form" onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="p-3 text-sm text-error bg-error/10 border border-error/20 rounded-xl font-medium">
          {error}
        </div>
      )}

      {/* Seção 1: Informações do Negócio */}
      <div className="space-y-4">
        <h4 className="text-sm font-bold text-primary uppercase tracking-widest border-b border-slate-100 pb-2">Informações do Negócio</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nome do Negócio</label>
            <input 
              type="text" 
              required
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              className="w-full p-3 rounded-xl border border-slate-100 focus:ring-2 focus:ring-primary/20 outline-none font-medium text-sm" 
              placeholder="Ex: Expansão Global"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Fonte do Lead</label>
            <select 
              value={formData.leadSource}
              onChange={(e) => setFormData({...formData, leadSource: e.target.value})}
              className="w-full p-3 rounded-xl border border-slate-100 focus:ring-2 focus:ring-primary/20 outline-none font-medium bg-white text-sm"
            >
              {LEAD_SOURCES.map(source => <option key={source} value={source}>{source}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Seção 2: Informações da Empresa */}
      <div className="space-y-4">
        <h4 className="text-sm font-bold text-primary uppercase tracking-widest border-b border-slate-100 pb-2">Dados da Empresa</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nome da Empresa</label>
            <input 
              type="text" 
              required
              value={formData.company}
              onChange={(e) => setFormData({...formData, company: e.target.value})}
              className="w-full p-3 rounded-xl border border-slate-100 focus:ring-2 focus:ring-primary/20 outline-none font-medium text-sm" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">CNPJ / CPF</label>
            <input 
              type="text" 
              value={formData.taxId}
              onChange={(e) => setFormData({...formData, taxId: formatCpfCnpj(e.target.value)})}
              className="w-full p-3 rounded-xl border border-slate-100 focus:ring-2 focus:ring-primary/20 outline-none font-medium text-sm" 
              placeholder="00.000.000/0001-00"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Segmento</label>
            <input 
              type="text" 
              value={formData.segment}
              onChange={(e) => setFormData({...formData, segment: e.target.value})}
              className="w-full p-3 rounded-xl border border-slate-100 focus:ring-2 focus:ring-primary/20 outline-none font-medium text-sm" 
            />
          </div>
        </div>
      </div>

      {/* Seção 3: Produtos e Preços (Dinâmico) */}
      <div className="space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
          <h4 className="text-sm font-bold text-primary uppercase tracking-widest">Produtos / Serviços</h4>
          <button 
            type="button"
            onClick={addProduct}
            className="text-xs font-bold text-primary flex items-center gap-1 hover:opacity-70 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            Adicionar Item
          </button>
        </div>
        
        <div className="space-y-3">
          {formData.products?.map((product, index) => (
            <div key={index} className="flex gap-4 items-end bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="flex-1 space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Produto</label>
                <input 
                  type="text" 
                  value={product.name}
                  onChange={(e) => updateProduct(index, 'name', e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-200 bg-white outline-none text-sm font-medium" 
                />
              </div>
              <div className="w-40 space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Preço (R$)</label>
                <input 
                  type="number" 
                  min="0"
                  step="0.01"
                  value={product.price}
                  onChange={(e) => updateProduct(index, 'price', e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-200 bg-white outline-none text-sm font-medium" 
                />
              </div>
              <button 
                type="button"
                onClick={() => removeProduct(index)}
                className="p-2 text-slate-400 hover:text-error transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          
          {/* Totalizador formatado em BRL */}
          <div className="flex justify-end pt-2">
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Valor Total</p>
              <p className="text-2xl font-headline font-extrabold text-primary">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(formData.totalValue)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Seção 4: Dados de Contato (Dinâmico) */}
      <div className="space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
          <h4 className="text-sm font-bold text-primary uppercase tracking-widest">Dados de Contato</h4>
          <button 
            type="button"
            onClick={addContact}
            className="text-xs font-bold text-primary flex items-center gap-1 hover:opacity-70 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            Adicionar Contato
          </button>
        </div>

        <div className="space-y-4">
          {formData.contacts?.map((contact, index) => (
            <div key={index} className="flex gap-4 items-end bg-slate-50 p-4 rounded-2xl border border-slate-100 relative">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 flex-1">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nome</label>
                  <input 
                    type="text" 
                    value={contact.name}
                    onChange={(e) => updateContact(index, 'name', e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-200 bg-white outline-none text-sm font-medium" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cargo</label>
                  <input 
                    type="text" 
                    value={contact.role}
                    onChange={(e) => updateContact(index, 'role', e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-200 bg-white outline-none text-sm font-medium" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Telefone</label>
                  <input 
                    type="text" 
                    value={contact.phone}
                    onChange={(e) => updateContact(index, 'phone', formatPhone(e.target.value))}
                    className="w-full p-2 rounded-lg border border-slate-200 bg-white outline-none text-sm font-medium" 
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">E-mail</label>
                  <input 
                    type="email" 
                    value={contact.email}
                    onChange={(e) => updateContact(index, 'email', e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-200 bg-white outline-none text-sm font-medium" 
                  />
                </div>
              </div>
              
              {formData.contacts.length > 1 && (
                <button 
                  type="button"
                  onClick={() => removeContact(index)}
                  className="p-2 text-slate-400 hover:text-error transition-colors shrink-0"
                  title="Remove Contact"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </form>
  );
};
