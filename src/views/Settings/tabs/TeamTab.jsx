import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, Button, Badge, LoadingSpinner, Avatar } from '@/components/ui';
import { getOrganizationMembers } from '@/services/members';
import { getInvitations, deleteInvitation } from '@/services/invitations';
import { InviteModal } from '../components/InviteModal';

export const TeamTab = ({ isAdmin }) => {
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);

  useEffect(() => {
    loadTeamData();
  }, []);

  async function loadTeamData() {
    try {
      setLoading(true);
      const [membersData, invitesData] = await Promise.all([
        getOrganizationMembers(),
        isAdmin ? getInvitations() : []
      ]);
      setMembers(membersData);
      setInvites(invitesData);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCancelInvite(id) {
    if (!confirm('Deseja realmente cancelar este convite?')) return;
    try {
      await deleteInvitation(id);
      setInvites(invites.filter(i => i.id !== id));
    } catch (error) {
      alert('Erro ao cancelar convite');
    }
  }

  if (loading) return <div className="py-20 flex justify-center"><LoadingSpinner /></div>;

  return (
    <div className="space-y-10">
      
      {/* Active Members */}
      <section>
        <div className="flex items-center justify-between mb-6 px-2">
          <h3 className="text-xl font-manrope font-black text-on-surface">Membros Ativos</h3>
          {isAdmin && (
            <Button variant="primary" size="sm" onClick={() => setShowInviteModal(true)} className="rounded-xl shadow-lg shadow-primary/20">
              <span className="material-symbols-outlined text-sm mr-2">person_add</span>
              Novo Convite
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {members.map((member) => (
            <Card key={member.userId} className="p-6 bg-white/40 backdrop-blur-sm border-white/60 hover:shadow-xl transition-all group">
              <div className="flex items-center gap-5">
                <Avatar 
                  src={member.avatar} 
                  name={member.name} 
                  className="w-20 h-20 rounded-[2.5rem] shadow-2xl border-4"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-manrope font-black text-on-surface truncate">{member.name}</p>
                    {member.role === 'admin' && <Badge variant="primary" className="text-[9px] px-1.5 py-0">ADMIN</Badge>}
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-tight">{member.position}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Pending Invitations (Admin only) */}
      {isAdmin && invites.length > 0 && (
        <section className="pt-10 border-t border-white/40">
           <h3 className="text-xl font-manrope font-black text-on-surface mb-6 px-2">Convites Pendentes</h3>
           <div className="space-y-4">
              {invites.map((invite) => (
                <div key={invite.id} className="flex items-center justify-between p-6 bg-white/20 backdrop-blur-sm rounded-3xl border border-dashed border-slate-300">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                      <span className="material-symbols-outlined">mail</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-on-surface">{invite.email}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                        Cargo: {invite.role} • Expira em {new Date(invite.expires_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-slate-400 hover:text-error"
                      onClick={() => handleCancelInvite(invite.id)}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-[10px] font-bold"
                      onClick={() => {
                        const link = `${window.location.origin}/register?token=${invite.token}`;
                        navigator.clipboard.writeText(link);
                        alert('Link de convite copiado!');
                      }}
                    >
                      Copiar Link
                    </Button>
                  </div>
                </div>
              ))}
           </div>
        </section>
      )}

      {showInviteModal && (
        <InviteModal 
          onClose={() => setShowInviteModal(false)} 
          onSuccess={() => {
            setShowInviteModal(false);
            loadTeamData();
          }} 
        />
      )}

    </div>
  );
};
