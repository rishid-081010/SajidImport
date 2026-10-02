import React, { useEffect, useState } from 'react';
import { 
  PlusCircle, Building2, Image as ImageIcon, Calendar, Trash2, 
  ArrowRight, RefreshCw, CheckCircle2, Clock, AlertTriangle, Search 
} from 'lucide-react';
import axios from 'axios';
import Toast from './Toast';

export default function Dashboard({ onNewListingClick, onSelectListing }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState({ msg: '', type: 'success' });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [typeFilter, setTypeFilter] = useState('All Types');

  const fetchListings = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get('/api/listings');
      if (response.data.success) {
        setListings(response.data.listings || []);
      } else {
        setError('Failed to load listings');
      }
    } catch (err) {
      console.error('Fetch listings error:', err);
      setError('Could not connect to server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchListings();
  }, []);

  const handleDeleteListing = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this listing and all associated images?')) return;

    try {
      const response = await axios.delete(`/api/listings/${id}`);
      if (response.data.success) {
        setListings((prev) => prev.filter((item) => item.id !== id));
        setToast({ msg: 'Listing deleted successfully.', type: 'success' });
      }
    } catch (err) {
      console.error('Delete error:', err);
      setToast({ msg: 'Failed to delete listing.', type: 'error' });
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 flex items-center gap-1.5 w-fit">
            <CheckCircle2 className="w-3.5 h-3.5" /> Completed
          </span>
        );
      case 'processing':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-khaki-500/15 text-khaki-300 border border-khaki-500/30 flex items-center gap-1.5 w-fit animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Processing
          </span>
        );
      case 'failed':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1.5 w-fit">
            <AlertTriangle className="w-3.5 h-3.5" /> Failed
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-navy-800 text-slate-300 border border-navy-700 flex items-center gap-1.5 w-fit">
            <Clock className="w-3.5 h-3.5 text-slate-400" /> Draft
          </span>
        );
    }
  };

  const filteredListings = listings.filter((item) => {
    const query = searchQuery.toLowerCase();
    const matchQuery =
      !query ||
      (item.name && item.name.toLowerCase().includes(query)) ||
      (item.reference && item.reference.toLowerCase().includes(query)) ||
      (item.property_type && item.property_type.toLowerCase().includes(query));

    let matchStatus = true;
    if (statusFilter === 'Completed') matchStatus = item.status === 'completed';
    else if (statusFilter === 'Processing') matchStatus = item.status === 'processing';
    else if (statusFilter === 'Draft') matchStatus = item.status === 'draft' || item.status === 'queued';

    let matchType = true;
    if (typeFilter !== 'All Types') matchType = item.property_type === typeFilter;

    return matchQuery && matchStatus && matchType;
  });

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-serif font-bold text-white tracking-tight">
            Listings Dashboard
          </h1>
          <p className="text-slate-400 mt-1 text-sm font-sans">
            Manage property photos, enhance resolution, and generate portal listings stored in Supabase.
          </p>
        </div>

        <button
          onClick={onNewListingClick}
          className="bg-gradient-to-r from-khaki-500 via-khaki-400 to-khaki-600 hover:from-khaki-400 hover:to-khaki-500 text-navy-950 px-5 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-khaki-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <PlusCircle className="w-5 h-5" />
          Create New Listing
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="glass-card p-5 mb-8 space-y-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by property name, reference (#MG-2026), or type..."
            className="w-full glass-input rounded-xl pl-11 pr-4 py-2.5 text-sm text-bone-100 placeholder-slate-500 focus:outline-none transition-all"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          {/* Status Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wider text-khaki-400 mr-1 flex items-center gap-1">
              STATUS:
            </span>
            {['All Status', 'Completed', 'Processing', 'Draft'].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`px-3.5 py-1 rounded-xl text-xs font-semibold transition-all ${
                  statusFilter === status
                    ? 'glass-pill-active font-bold text-white shadow-sm'
                    : 'glass-pill text-slate-400 hover:text-white'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Type Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wider text-khaki-400 mr-1 flex items-center gap-1">
              TYPE:
            </span>
            {['All Types', 'Apartment', 'Villa', 'Penthouse', 'Townhouse'].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setTypeFilter(type)}
                className={`px-3.5 py-1 rounded-xl text-xs font-semibold transition-all ${
                  typeFilter === type
                    ? 'glass-pill-active font-bold text-white shadow-sm'
                    : 'glass-pill text-slate-400 hover:text-white'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="glass-card p-12 text-center">
          <RefreshCw className="w-8 h-8 text-khaki-400 animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm font-medium">Loading property listings from Supabase...</p>
        </div>
      ) : error ? (
        <div className="glass-card p-6 text-center border-red-500/30 text-red-400">
          <p className="font-semibold mb-2">{error}</p>
          <button
            onClick={fetchListings}
            className="text-xs underline hover:text-red-300 font-medium"
          >
            Retry Connection
          </button>
        </div>
      ) : filteredListings.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-khaki-500/10 text-khaki-400 border border-khaki-500/20 flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <Building2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-serif font-bold text-white mb-1">No Listings Found</h3>
          <p className="text-slate-400 text-sm max-w-md mx-auto mb-6 font-sans">
            {searchQuery || statusFilter !== 'All Status' || typeFilter !== 'All Types'
              ? 'Try changing your search or filter options.'
              : 'Get started by creating your first listing and uploading property images for AI enhancement.'}
          </p>
          <button
            onClick={onNewListingClick}
            className="bg-gradient-to-r from-khaki-500 via-khaki-400 to-khaki-600 hover:from-khaki-400 hover:to-khaki-500 text-navy-950 px-6 py-3 rounded-2xl font-bold text-sm inline-flex items-center gap-2 shadow-lg shadow-khaki-500/20 transition-all hover:scale-[1.02]"
          >
            <PlusCircle className="w-5 h-5" />
            Create First Listing
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredListings.map((item) => (
            <div
              key={item.id}
              onClick={() => onSelectListing(item)}
              className="glass-card p-6 cursor-pointer group transition-all hover:scale-[1.01] flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-khaki-400 bg-khaki-500/10 px-2.5 py-0.5 rounded-md border border-khaki-500/20 backdrop-blur-sm">
                      {item.property_type || 'Apartment'}
                    </span>
                    {item.reference && (
                      <span className="ml-2 text-xs font-mono text-slate-400">#{item.reference}</span>
                    )}
                  </div>
                  {getStatusBadge(item.status)}
                </div>

                <h3 className="text-lg font-serif font-bold text-white group-hover:text-khaki-300 transition-colors line-clamp-1 mb-2">
                  {item.name}
                </h3>

                <div className="flex items-center gap-4 text-xs text-slate-400 mb-4">
                  <span className="flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-khaki-400" />
                    {item.total_images || 0} Photos
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between mt-2">
                <span className="text-xs font-semibold text-khaki-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  Open Listing <ArrowRight className="w-3.5 h-3.5" />
                </span>

                <button
                  onClick={(e) => handleDeleteListing(e, item.id)}
                  className="p-2 rounded-xl text-slate-500 hover:text-red-400 hover:bg-white/[0.05] transition-colors"
                  title="Delete Listing"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Clean popup toast */}
      <Toast
        message={toast.msg}
        type={toast.type}
        onClose={() => setToast({ msg: '', type: 'success' })}
      />
    </div>
  );
}
