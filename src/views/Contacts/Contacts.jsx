import React from 'react';
import { Mail, Phone, MoreVertical, MessageSquare } from 'lucide-react';
import { mockContacts } from '@/data/mockData';
import { Card, Button, PageHeader, SearchBar, LoadingSpinner, ErrorMessage, Avatar } from '@/components/ui';
import { useSearch } from '@/hooks/useSearch';
import { useSupabase } from '@/hooks/useSupabase';
import { getContacts } from '@/services/contacts';

const ContactCard = ({ contact }) => (
  <Card variant="glass" className="p-8 group relative overflow-hidden flex flex-col h-full">
    <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/[0.02] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    
    {/* Options on top */}
    <div className="absolute top-6 right-6 z-20">
      <button className="w-10 h-10 rounded-2xl bg-white/20 hover:bg-white text-on-surface-variant transition-all border border-white/60 shadow-sm flex items-center justify-center">
        <MoreVertical className="w-4 h-4" />
      </button>
    </div>

    {/* Avatar + Main Info */}
    <div className="flex flex-col items-center text-center mb-8 relative z-10">
      <div className="w-24 h-24 rounded-[2rem] bg-white/60 flex items-center justify-center overflow-hidden shrink-0 border-4 border-white shadow-md transition-all group-hover:scale-110 group-hover:rotate-3 mb-5">
        {contact.avatar ? (
          <img src={contact.avatar} alt={contact.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-4xl font-manrope font-black text-primary opacity-40">
            {contact.name.charAt(0)}
          </span>
        )}
      </div>
      <div className="px-2">
        <h3 className="font-manrope font-black text-2xl text-on-surface leading-tight tracking-tight group-hover:text-primary transition-colors mb-1">
          {contact.name}
        </h3>
        <div className="flex flex-col gap-1 items-center">
          <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">{contact.role}</p>
          <div className="flex items-center gap-2 text-[11px] text-slate-400 font-bold uppercase tracking-widest opacity-60">
            <span className="material-symbols-outlined text-sm">business</span>
            {contact.company}
          </div>
        </div>
      </div>
    </div>

    {/* Contact Info - Integrated */}
    <div className="space-y-4 mb-8 relative z-10 px-2">
      <ContactRow icon="mail" label={contact.email} />
      <ContactRow icon="phone" label={contact.phone} />
    </div>

    {/* Footer - Social Clean */}
    <div className="mt-auto pt-6 border-t border-white/20 flex items-center justify-between relative z-10">
      <div className="flex items-center gap-3">
        <Avatar 
          src={contact.ownerAvatar} 
          name={contact.owner} 
          size="sm"
          className="w-8 h-8 border-white/60 shadow-sm"
        />
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest opacity-60">
          {contact.ownerPosition}
        </span>
      </div>
      <button className="w-10 h-10 rounded-2xl bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all flex items-center justify-center shadow-sm">
        <MessageSquare className="w-5 h-5" />
      </button>
    </div>
  </Card>
);

const ContactRow = ({ icon, label }) => (
  <div className="flex items-center gap-3 text-xs text-on-surface-variant hover:text-primary transition-colors cursor-pointer group/r">
    <span className="material-symbols-outlined text-base opacity-40 group-hover/r:opacity-100">{icon}</span>
    <span className="font-medium truncate">{label}</span>
  </div>
);

export default function Contacts() {
  const { data, loading, error, refetch } = useSupabase(getContacts);
  const contacts = data?.length ? data : mockContacts;
  const { query, setQuery, filtered } = useSearch(contacts, ['name', 'role', 'company', 'email']);

  return (
    <div className="animate-in fade-in duration-700 max-w-7xl mx-auto w-full">
      <PageHeader
        title="Stakeholders Chave"
        subtitle="Diretório de tomadores de decisão e influenciadores estratégicos."
        actions={<Button icon="person_add">Novo Contato</Button>}
      />

      <div className="flex items-center gap-4 bg-white/20 backdrop-blur-md p-3 rounded-[2rem] border border-white/40 mb-10 shadow-sm max-w-2xl">
        <SearchBar
          placeholder="Buscar por nome, cargo ou empresa..."
          value={query}
          onChange={setQuery}
          className="bg-transparent border-0 shadow-none focus-within:ring-0 flex-1"
        />
        <button className="w-12 h-12 rounded-2xl border border-white/60 bg-white/40 hover:bg-white text-slate-400 hover:text-primary transition-all flex items-center justify-center shadow-sm">
          <span className="material-symbols-outlined">filter_list</span>
        </button>
      </div>

      {loading && <LoadingSpinner message="Carregando contatos..." />}
      {error   && <ErrorMessage message={error} onRetry={refetch} />}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((contact) => (
            <ContactCard key={contact.id} contact={contact} />
          ))}
        </div>
      )}
    </div>
  );
}
