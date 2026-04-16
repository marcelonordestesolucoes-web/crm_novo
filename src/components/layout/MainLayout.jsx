import React, { useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { Modal } from '@/components/ui';
import { ProfileTab } from '@/views/Settings/tabs/ProfileTab';
import { useMouseGlow } from "@/hooks/useMouseGlow";

export const MainLayout = ({ children }) => {
  const [showProfileModal, setShowProfileModal] = useState(false);
  const mouse = useMouseGlow();

  return (
    <div className="min-h-screen flex text-on-surface relative overflow-hidden">
      {/* 🔮 LIVING LAYER (Breathing Masterpiece) — Fix do Z-index para visibilidade real */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        {/* Base Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200" />
        
        {/* ⚛️ LIVING ORBS — Animados e Neon */}
        <div className="absolute top-0 left-[-100px] w-[600px] h-[80%] bg-indigo-600/25 blur-[160px] animate-breathing opacity-80" />
        <div className="absolute top-1/4 right-[-100px] w-[500px] h-[70%] bg-purple-600/20 blur-[150px] animate-breathing-slow opacity-70" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-full h-1/2 bg-blue-500/15 blur-[180px] animate-breathing-fast opacity-60" />
        <div className="absolute bottom-[-100px] right-1/4 w-[700px] h-[400px] bg-teal-400/15 blur-[140px] animate-pulse opacity-50" />
        
        {/* 🌈 MOUSE REACTIVE GLOBAL GLOW — Presença Atmosférica */}
        <div
          className="absolute inset-0 z-10 pointer-events-none transition-opacity duration-1000"
          style={{
            background: `radial-gradient(
              600px circle at ${mouse.x}px ${mouse.y}px,
              rgba(99,102,241,0.12),
              transparent 40%
            )`,
          }}
        />
      </div>

      <Sidebar />

      <div className="flex-1 flex flex-col ml-[280px] min-w-0 relative z-10">
        <TopBar onOpenProfile={() => setShowProfileModal(true)} />

        <main className="flex-1 pt-[72px]">
          <div className="px-8 pb-8 pt-0 md:px-10 md:pb-10 md:pt-0 max-w-[1600px] mx-auto w-full 
            animate-in fade-in slide-in-from-bottom-4 duration-700">
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
