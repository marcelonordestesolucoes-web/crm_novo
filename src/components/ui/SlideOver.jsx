import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export const SlideOver = ({ 
  isOpen, 
  onClose, 
  title, 
  description,
  children,
  footer
}) => {
  // Disables background scrolling when the slide-over is open
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  // Handle escape key to close
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-navy/20 backdrop-blur-md transition-opacity"
          />

          {/* Slide-over panel */}
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 200 }}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-md flex flex-col bg-white/80 backdrop-blur-2xl shadow-[-20px_0_50px_-12px_rgba(0,0,0,0.1)] border-l border-white/40"
          >
            {/* Header - Ultra Clean */}
            <div className="px-10 pt-10 pb-6 flex items-start justify-between relative z-10">
              <div>
                <h2 className="text-2xl font-manrope font-black text-on-surface tracking-tight">{title}</h2>
                {description && (
                  <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-400 opacity-60">{description}</p>
                )}
              </div>
              <button
                onClick={onClose}
               className="w-10 h-10 rounded-full bg-slate-100/50 hover:bg-white text-slate-400 hover:text-primary transition-all flex items-center justify-center shadow-sm"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content (Scrollable) */}
            <div className="flex-1 overflow-y-auto px-10 py-4 relative z-10 font-inter">
              {children}
            </div>

            {/* Footer - Integrated Glass */}
            {footer && (
              <div className="px-10 py-6 bg-white/40 backdrop-blur-sm border-t border-white/20 flex justify-end gap-3 mt-auto relative z-10">
                {footer}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
