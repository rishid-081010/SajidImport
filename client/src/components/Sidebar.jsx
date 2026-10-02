import React from 'react';
import { 
  LayoutDashboard, Sparkles, FileText, ShieldCheck, 
  FolderArchive, Building2, PlusCircle, CheckCircle2 
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, onNewListingClick }) {
  const navItems = [
    { id: 'dashboard', label: 'Listings Dashboard', icon: LayoutDashboard },
    { id: 'new', label: 'Enhance Photos', icon: Sparkles, highlight: true },
    { id: 'portals', label: 'Dubai Portal Copy', icon: FileText },
    { id: 'qa-guardrail', label: 'QA Guardrails', icon: ShieldCheck },
  ];

  return (
    <aside className="w-full lg:w-64 shrink-0">
      <div className="glass-sidebar p-6 flex flex-col justify-between min-h-[580px] lg:min-h-[calc(100vh-3.5rem)] sticky top-6">
        <div>
          {/* A SQUARED Logo Brand Header */}
          <div 
            onClick={() => setActiveTab('dashboard')}
            className="flex flex-col items-center text-center cursor-pointer group pb-8 pt-2 select-none border-b border-white/[0.06]"
          >
            {/* Elegant Monogram & Logo Crest */}
            <div className="mb-3">
              <svg viewBox="0 0 100 80" className="w-14 h-12 text-khaki-400 mx-auto transition-transform group-hover:scale-105" fill="none">
                <path 
                  d="M50 10 L68 55 L32 55 Z" 
                  stroke="currentColor" 
                  strokeWidth="2.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                />
                <path 
                  d="M40 40 Q50 25 60 40 Q50 55 40 40 Z" 
                  stroke="#f3f1e8" 
                  strokeWidth="1.5" 
                  fill="rgba(183,169,144,0.15)" 
                />
                <circle cx="50" cy="22" r="3" fill="#b7a990" />
              </svg>
            </div>

            <span className="font-serif font-bold text-lg tracking-[0.2em] text-white group-hover:text-khaki-300 transition-colors uppercase">
              A SQUARED
            </span>
            <span className="text-[9px] font-medium tracking-[0.32em] text-khaki-500 uppercase mt-0.5">
              REAL ESTATE
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="mt-6 space-y-2">
            {navItems.map((item) => {
              const isActive = (activeTab === item.id) || (item.id === 'dashboard' && (activeTab === 'dashboard' || activeTab === 'detail'));
              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.id === 'new') {
                      onNewListingClick ? onNewListingClick() : setActiveTab('new');
                    } else if (item.id === 'dashboard') {
                      setActiveTab('dashboard');
                    } else {
                      setActiveTab('dashboard');
                    }
                  }}
                  className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-xs font-semibold tracking-wide transition-all text-left ${
                    isActive
                      ? 'glass-nav-active font-bold text-white shadow-lg'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-khaki-400' : 'text-slate-400'}`} />
                  <span className="text-sm font-normal">
                    {item.label}
                  </span>
                  {item.highlight && (
                    <span className="ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-khaki-500/20 text-khaki-300 border border-khaki-500/30">
                      QA
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer info inside sidebar */}
        <div className="pt-6 border-t border-white/[0.06] mt-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-[11px] text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span className="font-mono text-[10px] text-slate-300">FastAPI & Supabase Live</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-2 font-sans">
            Dubai Land Department Ready
          </p>
        </div>
      </div>
    </aside>
  );
}
