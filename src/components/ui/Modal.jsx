import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Modal = ({ 
  isOpen, 
  onClose, 
  title, 
  children,
  footer,
  className
}) => {
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[9999] bg-navy/20 backdrop-blur-md transition-opacity"
          />

          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 40 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className={cn(
                "bg-white/80 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.1)] flex flex-col w-full pointer-events-auto max-h-[90vh] overflow-hidden border border-white/40",
                className || "max-w-2xl"
              )}
            >
              {/* Header - Ultra Clean */}
              <div className="px-10 py-8 flex items-center justify-between relative z-10">
                <h2 className="text-2xl font-manrope font-black text-on-surface tracking-tight">{title}</h2>
                <button
                  onClick={onClose}
                  className="w-10 h-10 rounded-full bg-slate-100/50 hover:bg-white text-slate-400 hover:text-primary transition-all flex items-center justify-center shadow-sm"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-10 pb-10 pt-2 font-inter relative z-10">
                {children}
              </div>

              {/* Footer - Integrated Glass */}
              {footer && (
                <div className="px-10 py-6 bg-white/40 backdrop-blur-sm border-t border-white/20 flex justify-end gap-3 relative z-10">
                  {footer}
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
};
