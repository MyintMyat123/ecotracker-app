import React from 'react';
import SpeciesSearch from './SpeciesSearch';
import type { WatchlistItem, WatchlistPayload } from '../api';

interface LandingHeroProps {
  isAuthenticated: boolean;
  watchlist: WatchlistItem[];
  savingKey: number | null;
  removingKey: number | null;
  onAddToWatchlist: (payload: WatchlistPayload) => void;
  onRemoveFromWatchlist: (gbifSpeciesKey: number) => void;
  onViewTracker: (species: { usageKey: number; commonName: string }) => void;
  onSignIn: () => void;
}

const STATS = [
  { value: '2.5M+', label: 'Species Tracked' },
  { value: '44,000+', label: 'Threatened Species' },
  { value: '195', label: 'Countries Covered' },
  { value: '1.8B+', label: 'Occurrence Records' },
];

const LandingHero: React.FC<LandingHeroProps> = ({
  isAuthenticated,
  watchlist,
  savingKey,
  removingKey,
  onAddToWatchlist,
  onRemoveFromWatchlist,
  onViewTracker,
  onSignIn,
}) => {
  return (
    <div className="space-y-0">
      {/* Hero Section */}
      <section className="relative overflow-hidden min-h-[88vh] flex flex-col items-center justify-center px-4 py-20">
        {/* Background elements */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-cyan-500/5 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-teal-500/3 rounded-full blur-3xl" />
          {/* Grid pattern */}
          <div
            className="absolute inset-0 opacity-[0.025]"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
              backgroundSize: '60px 60px',
            }}
          />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto text-center space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-bold uppercase tracking-[0.24em]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Powered by GBIF · Global Biodiversity Information Facility
          </div>

          {/* Headline */}
          <div className="space-y-4">
            <h1 className="text-5xl md:text-7xl font-black leading-[1.05] tracking-tight">
              <span className="text-white">Monitor &</span>
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400">
                Protect
              </span>
              <br />
              <span className="text-white">Endangered Species</span>
            </h1>
            <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
              Real-time tracking of threatened wildlife worldwide. Explore species data,
              monitor habitats, and build your personal conservation watchlist.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => document.getElementById('search-section')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold rounded-full text-sm uppercase tracking-[0.18em] transition-all duration-300 shadow-[0_0_30px_-8px_rgba(16,185,129,0.6)] hover:shadow-[0_0_40px_-8px_rgba(16,185,129,0.8)]"
            >
              Start Exploring
            </button>
            {!isAuthenticated && (
              <button
                type="button"
                onClick={onSignIn}
                className="px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white font-semibold rounded-full text-sm uppercase tracking-[0.18em] transition-all duration-300"
              >
                Create Account
              </button>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto pt-8">
            {STATS.map((stat) => (
              <div key={stat.label} className="text-center space-y-1">
                <div className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                  {stat.value}
                </div>
                <div className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-semibold">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce">
          <span className="text-[9px] uppercase tracking-[0.3em] text-slate-600">Scroll to explore</span>
          <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </section>

      {/* Feature Highlights */}
      <section className="px-4 py-16 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: (
                <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
                </svg>
              ),
              title: 'Interactive Distribution Maps',
              desc: 'Visualize species ranges and occurrence hotspots with live GBIF map overlays.',
              color: 'from-emerald-500/10 to-teal-500/10 border-emerald-500/15',
            },
            {
              icon: (
                <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              ),
              title: 'AI-Powered Summaries',
              desc: 'Complex conservation data simplified into clear, actionable bullet points by AI.',
              color: 'from-cyan-500/10 to-blue-500/10 border-cyan-500/15',
            },
            {
              icon: (
                <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
              ),
              title: 'Smart Notifications',
              desc: 'Get alerts about conservation status changes and new sightings for your watchlist.',
              color: 'from-amber-500/10 to-orange-500/10 border-amber-500/15',
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className={`rounded-2xl border bg-gradient-to-br ${feature.color} p-6 space-y-3`}
            >
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
                {feature.icon}
              </div>
              <h3 className="text-white font-bold text-base">{feature.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Search Section */}
      <section id="search-section" className="px-4 pb-20">
        <SpeciesSearch
          isAuthenticated={isAuthenticated}
          watchlist={watchlist}
          savingKey={savingKey}
          removingKey={removingKey}
          onAddToWatchlist={onAddToWatchlist}
          onRemoveFromWatchlist={onRemoveFromWatchlist}
          onViewTracker={onViewTracker}
        />
      </section>
    </div>
  );
};

export default LandingHero;
