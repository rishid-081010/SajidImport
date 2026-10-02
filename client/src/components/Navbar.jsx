import React from 'react';
import { Building2, Sparkles, FileSpreadsheet } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab }) {
  return (
    <header className="glass-panel sticky top-0 z-50 border-b border-white/[0.08]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand: A SQUARED REAL ESTATE */}
        <div 
          onClick={() => setActiveTab('dashboard')} 
          className="flex items-center gap-3.5 cursor-pointer group select-none"
        >
          {/* Stylized AS Monogram Emblem */}
          <div className="w-11 h-11 rounded-2xl bg-white/[0.05] border border-white/[0.12] flex items-center justify-center shadow-lg shadow-black/40 group-hover:border-khaki-400/60 transition-all duration-300 backdrop-blur-md">
            <svg viewBox="0 0 100 100" className="w-8 h-8 text-khaki-400 group-hover:scale-105 transition-transform" fill="currentColor">
              <text 
                x="50%" 
                y="66%" 
                textAnchor="middle" 
                fontFamily="Cinzel, Denton, Georgia, serif" 
                fontSize="46" 
                fontWeight="700" 
                fill="#b7a990"
                letterSpacing="-2"
              >
                AS
              </text>
            </svg>
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2.5">
              <span className="font-serif font-bold text-lg tracking-[0.15em] text-white group-hover:text-khaki-300 transition-colors">
                A SQUARED
              </span>
              <span className="px-2 py-0.5 text-[9px] font-bold tracking-widest uppercase bg-khaki-500/10 text-khaki-400 border border-khaki-500/25 rounded-md flex items-center gap-1 backdrop-blur-sm">
                <Sparkles className="w-2.5 h-2.5" /> ADMIN SUITE
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-semibold tracking-[0.28em] text-khaki-500 uppercase">
                REAL ESTATE
              </span>
              <span className="text-[9px] text-slate-500 font-bold">•</span>
              <span className="text-[9px] text-slate-400 tracking-wider">
                DUBAI
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs (2 Dedicated Studio Tabs) */}
        <nav className="flex items-center gap-3">
          {/* Feature 1: Listing Studio */}
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-semibold tracking-wide transition-all ${
              activeTab === 'dashboard' || activeTab === 'detail' || activeTab === 'new'
                ? 'glass-pill-active font-bold text-white shadow-md'
                : 'glass-pill text-slate-300 hover:text-white'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-khaki-400" />
            Listing Studio
          </button>

          {/* Feature 2: Lead Ingestion & Cleaning Studio */}
          <button
            onClick={() => setActiveTab('leads')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-semibold tracking-wide transition-all ${
              activeTab === 'leads'
                ? 'glass-pill-active font-bold text-emerald-300 shadow-md border-emerald-500/40'
                : 'glass-pill text-slate-300 hover:text-white'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            Lead Ingestion & Cleaning
          </button>
        </nav>
      </div>
    </header>
  );
}
