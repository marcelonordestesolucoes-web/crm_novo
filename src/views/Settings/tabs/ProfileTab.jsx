import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, Button, LoadingSpinner, Avatar } from '@/components/ui';
import { getCurrentProfile, updateProfile, uploadAvatar } from '@/services/profile';
import { useAuth } from '@/contexts/AuthContext';
import { Mail, Phone, User, Briefcase, Camera } from 'lucide-react';

export const ProfileTab = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    full_name: '',
    phone: '',
    position: '',
    avatar_url: '',
    email: ''
  });
  const [avatarFile, setAvatarFile] = useState(null);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      setLoading(true);
      const data = await getCurrentProfile();
      if (data) {
        // Fallback para o nome do Auth se o perfil estiver incompleto
        const authName = user?.user_metadata?.full_name ?? user?.email?.split('@')[0];
        setProfile({
          ...data,
          full_name: data.full_name || authName || '',
          email: user?.email || ''
        });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      setSaving(true);
      
      // 1. Upload de avatar se houver novo arquivo
      if (avatarFile) {
        const newUrl = await uploadAvatar(avatarFile);
        setProfile(prev => ({ ...prev, avatar_url: newUrl }));
        setAvatarFile(null);
      }

      // 2. Atualizar dados
      await updateProfile(profile);
      alert('Perfil atualizado com sucesso!');
    } catch (error) {
      alert('Erro ao atualizar perfil: ' + error.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="py-20 flex justify-center"><LoadingSpinner /></div>;

  return (
    <div className="space-y-8">
      <Card className="p-10 bg-white/40 backdrop-blur-xl border-white/60 shadow-2xl relative overflow-hidden">
        
        <form onSubmit={handleSubmit} className="relative z-10">
          
          <div className="flex flex-col md:flex-row gap-12">
            
            {/* Avatar Section */}
            <div className="flex flex-col items-center gap-6">
               <div className="relative group">
                  <div className="w-40 h-40 rounded-[3rem] bg-slate-100 border-4 border-white shadow-xl overflow-hidden">
                    <Avatar 
                      src={avatarFile ? URL.createObjectURL(avatarFile) : profile.avatar_url} 
                      name={profile.full_name} 
                      size="2xl"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <label className="absolute bottom-2 right-2 w-12 h-12 bg-primary text-white rounded-2xl flex items-center justify-center cursor-pointer shadow-lg hover:scale-110 active:scale-95 transition-all">
                    <Camera size={20} />
                    <input type="file" className="hidden" accept="image/*" onChange={e => setAvatarFile(e.target.files[0])} />
                  </label>
               </div>
               <div className="text-center">
                 <p className="text-sm font-manrope font-black text-on-surface">Foto de Perfil</p>
                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">JPG, PNG ou WebP</p>
               </div>
            </div>

            {/* Form Section */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8">
               
               <div className="space-y-2">
                 <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
                 <div className="relative">
                   <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                   <input
                     required
                     className="w-full bg-white/50 border border-white/80 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all shadow-sm"
                     value={profile.full_name}
                     onChange={e => setProfile({...profile, full_name: e.target.value})}
                   />
                 </div>
               </div>

               <div className="space-y-2">
                 <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest ml-1">Cargo / Função</label>
                 <div className="relative">
                   <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                   <input
                     required
                     placeholder="Ex: Diretor Comercial"
                     className="w-full bg-white/50 border border-white/80 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all shadow-sm"
                     value={profile.position}
                     onChange={e => setProfile({...profile, position: e.target.value})}
                   />
                 </div>
               </div>

               <div className="space-y-2">
                 <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest ml-1">WhatsApp / Telefone</label>
                 <div className="relative">
                   <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                   <input
                     placeholder="(00) 00000-0000"
                     className="w-full bg-white/50 border border-white/80 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all shadow-sm"
                     value={profile.phone}
                     onChange={e => setProfile({...profile, phone: e.target.value})}
                   />
                 </div>
               </div>

               <div className="space-y-2 opacity-60">
                 <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest ml-1">E-mail corporativo (Inalterável)</label>
                 <div className="relative">
                   <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                   <input
                     disabled
                     className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-slate-500 cursor-not-allowed"
                     value={profile.email}
                   />
                 </div>
               </div>

            </div>
          </div>

          <div className="mt-12 pt-10 border-t border-white/40 flex justify-end gap-4">
             <Button variant="outline" type="button" onClick={() => loadProfile()}>Resetar</Button>
             <Button variant="primary" type="submit" disabled={saving} className="px-10 h-14 rounded-2xl shadow-xl shadow-primary/20">
               {saving ? <LoadingSpinner size="sm" color="white" /> : 'Salvar Alterações'}
             </Button>
          </div>

        </form>

      </Card>
    </div>
  );
};
