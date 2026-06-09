import React, { useState, useEffect } from 'react';
import WorldMap from './WorldMap';
import { API_BASE_URL } from '../api';

interface Species {
  id: number;
  name: string;
  common_name: string | null;
  scientific_name: string;
  conservation_status: string;
  country: string;
}

interface CountrySpeciesPageProps {
  onViewTracker?: (species: { usageKey: number; commonName: string }) => void;
}

const CountrySpeciesPage: React.FC<CountrySpeciesPageProps> = ({ onViewTracker }) => {
  const [selectedCountryName, setSelectedCountryName] = useState<string>('');
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>('');
  const [speciesList, setSpeciesList] = useState<Species[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  useEffect(() => {
    const fetchSpeciesByCountry = async () => {
      if (!selectedCountryCode) {
        setSpeciesList([]);
        setIsSidebarOpen(false);
        return;
      }
      setLoading(true);
      setError(null);
      setIsSidebarOpen(true);
      try {
        const response = await fetch(`${API_BASE_URL}/species/country/${selectedCountryCode}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to fetch species data');
        }
        const data = await response.json();
        setSpeciesList(data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch species data.');
        setSpeciesList([]);
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchSpeciesByCountry();
  }, [selectedCountryCode]);

  const handleCloseSidebar = () => {
    setIsSidebarOpen(false);
    setSelectedCountryCode('');
    setSelectedCountryName('');
  };

  const handleSelectCountry = (name: string, code: string) => {
    if (!name || !code) {
      handleCloseSidebar();
    } else {
      setSelectedCountryName(name);
      setSelectedCountryCode(code);
    }
  };

  return (
    <div className="h-[calc(100vh-80px)] w-full relative overflow-hidden bg-slate-950">
      {/* Interactive Map Background */}
      <div className="absolute inset-0 z-0">
        <WorldMap
          onSelectCountry={handleSelectCountry}
          selectedCountryCode={selectedCountryCode}
        />
      </div>

      {/* Instruction Overlay */}
      <div className="absolute top-6 left-6 z-10 pointer-events-none max-w-sm">
        <div className="bg-slate-900/80 border border-white/10 backdrop-blur-md px-5 py-4 rounded-2xl shadow-xl">
          <h1 className="text-xl font-extrabold text-white mb-1 tracking-tight">Species by Country</h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            Click any country on the interactive map to explore its critically endangered and endangered species.
          </p>
        </div>
      </div>

      {/* Floating Sidebar Overlay */}
      <div
        className={`absolute right-6 top-6 bottom-6 w-full max-w-2xl bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex flex-col transition-all duration-500 ease-out z-[1000] ${
          isSidebarOpen ? 'translate-x-0 opacity-100' : 'translate-x-[120%] opacity-0 pointer-events-none'
        }`}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              {selectedCountryName}
            </h2>
            {!loading && !error && (
              <p className="text-xs text-emerald-400 font-medium">
                {speciesList.length} {speciesList.length === 1 ? 'Endangered Species' : 'Endangered Species'} Found
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleCloseSidebar}
            className="h-8 w-8 rounded-full bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-white/10 hover:border-red-500/25 flex items-center justify-center transition-all duration-200 cursor-pointer shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Sidebar Content */}
        <div className="flex-grow overflow-y-auto px-6 py-5 custom-scrollbar">
          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="animate-pulse bg-white/5 border border-white/5 h-32 rounded-xl p-4 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="h-4 bg-white/10 rounded w-3/4"></div>
                    <div className="h-3 bg-white/5 rounded w-1/2"></div>
                  </div>
                  <div className="h-5 bg-white/10 rounded-full w-24"></div>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
              <div className="p-3 bg-red-950/30 border border-red-500/20 text-red-400 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-200">Failed to load species</h3>
                <p className="text-xs text-slate-400 mt-1">{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && (
            <>
              {speciesList.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4">
                  {speciesList.map((species) => {
                    const hasCommonName = species.common_name && species.common_name.toLowerCase() !== species.scientific_name.toLowerCase();
                    const iucnColor = species.conservation_status === 'CR'
                      ? 'bg-red-500/10 text-red-400 border-red-500/25'
                      : species.conservation_status === 'EN'
                        ? 'bg-orange-500/10 text-orange-400 border-orange-500/25'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/25';

                    const iucnLabel = species.conservation_status === 'CR'
                      ? 'Critically Endangered'
                      : species.conservation_status === 'EN'
                        ? 'Endangered'
                        : 'Vulnerable';

                    return (
                      <div
                        key={species.id}
                        className="group bg-slate-950/45 hover:bg-slate-950/80 border border-white/5 hover:border-emerald-500/25 rounded-2xl p-4 flex flex-col justify-between transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/5"
                      >
                        <div>
                          <div className="flex justify-between items-start gap-2 mb-2.5">
                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${iucnColor}`} title={iucnLabel}>
                              {species.conservation_status}
                            </span>
                          </div>

                          <h3 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors line-clamp-1">
                            {hasCommonName ? species.common_name : species.scientific_name}
                          </h3>
                          {hasCommonName && (
                            <p className="text-xs text-slate-400 italic line-clamp-1 mt-0.5">
                              {species.scientific_name}
                            </p>
                          )}
                        </div>

                        {onViewTracker && (
                          <button
                            type="button"
                            onClick={() => onViewTracker({
                              usageKey: species.id,
                              commonName: species.common_name || species.scientific_name
                            })}
                            className="mt-4 text-[10px] font-bold tracking-wider text-emerald-400 hover:text-emerald-300 uppercase flex items-center gap-1 group/btn w-fit p-0 border-0 bg-transparent transition-all"
                          >
                            View Live Tracker
                            <span className="group-hover/btn:translate-x-1 transition-transform">→</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
                  <div className="p-3 bg-slate-900/50 border border-white/5 text-slate-500 rounded-full">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-300">No species records found</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs">
                      There are no critically endangered or endangered animals recorded in our database for {selectedCountryName}.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CountrySpeciesPage;
