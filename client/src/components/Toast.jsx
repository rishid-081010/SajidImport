import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export default function Toast({ message, type = 'success', onClose, duration = 3500 }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      if (onClose) onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  const isSuccess = type === 'success';
  const isError = type === 'error';

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300 pointer-events-auto">
      <div
        className={`glass-panel flex items-center gap-3 px-4 py-3.5 rounded-2xl shadow-2xl border ${
          isSuccess
            ? 'border-emerald-500/40 bg-emerald-950/80 text-emerald-200'
            : isError
            ? 'border-red-500/40 bg-red-950/80 text-red-200'
            : 'border-khaki-500/40 bg-navy-950/90 text-bone-100'
        }`}
      >
        {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />}
        {isError && <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />}
        {!isSuccess && !isError && <Info className="w-5 h-5 text-khaki-400 flex-shrink-0" />}

        <span className="text-xs font-semibold tracking-wide font-sans">{message}</span>

        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-white/[0.1] text-slate-400 hover:text-white transition-colors ml-2"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
