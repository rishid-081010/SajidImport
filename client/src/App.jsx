import React, { useState } from 'react';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import NewListing from './components/NewListing';
import ListingDetail from './components/ListingDetail';
import LeadIngestionStudio from './components/LeadIngestionStudio';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedListingId, setSelectedListingId] = useState(null);

  const handleListingCreated = (newListing) => {
    setSelectedListingId(newListing.id);
    setActiveTab('detail');
  };

  const handleSelectListing = (listing) => {
    setSelectedListingId(listing.id);
    setActiveTab('detail');
  };

  return (
    <div className="min-h-screen text-bone-100 flex flex-col selection:bg-khaki-500 selection:text-navy-950">
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          if (tab !== 'detail') setSelectedListingId(null);
        }}
      />

      <main className="flex-1">
        {activeTab === 'dashboard' && (
          <Dashboard
            onNewListingClick={() => setActiveTab('new')}
            onSelectListing={handleSelectListing}
          />
        )}

        {activeTab === 'new' && (
          <NewListing onListingCreated={handleListingCreated} />
        )}

        {activeTab === 'detail' && selectedListingId && (
          <ListingDetail
            listingId={selectedListingId}
            onBack={() => {
              setActiveTab('dashboard');
              setSelectedListingId(null);
            }}
          />
        )}

        {activeTab === 'leads' && (
          <LeadIngestionStudio />
        )}
      </main>

      <footer className="border-t border-white/[0.06] py-6 text-center text-xs text-slate-400 bg-black/30 backdrop-blur-md">
        <div className="flex items-center justify-center gap-2 font-medium tracking-wide">
          <span className="font-serif font-bold text-khaki-400">A SQUARED REAL ESTATE</span>
          <span className="text-slate-600">•</span>
          <span className="italic text-slate-400">Live The Refined Life</span>
          <span className="text-slate-600">•</span>
          <span>Dubai, United Arab Emirates &copy; 2026</span>
        </div>
      </footer>
    </div>
  );
}
