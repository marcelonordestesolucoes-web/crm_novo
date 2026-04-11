import React, { useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { Modal } from '@/components/ui';
import { ProfileTab } from '@/views/Settings/tabs/ProfileTab';

export const MainLayout = ({ children }) => {
  const [showProfileModal, setShowProfileModal] = useState(false);

  return (
    <div className="min-h-screen bg-surface flex text-on-surface">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-[280px] min-w-0">
        <TopBar onOpenProfile={() => setShowProfileModal(true)} />
        <main className="flex-1 pt-[72px]">
          <div className="p-8 md:p-10 max-w-[1600px] mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
            {children}
          </div>
        </main>
      </div>

      <Modal 
        isOpen={showProfileModal} 
        onClose={() => setShowProfileModal(false)}
        title="Meu Perfil"
        className="max-w-4xl"
      >
        <div className="py-2">
          <ProfileTab />
        </div>
      </Modal>
    </div>
  );
};
