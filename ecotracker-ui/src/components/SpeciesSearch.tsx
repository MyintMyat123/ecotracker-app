import React, { useState } from 'react';
import SpeciesTracker from './SpeciesTracker';

export interface IucnStatus {
  category: string;
  code: string;
}

interface Species {
  key: number;
  scientificName: string;
  canonicalName: string;
  rank: string;
  taxonomicStatus: string;
  kingdom: string;
  phylum: string;
  order: string;
  family: string;
  genus: string;
  iucnRedListStatus?: IucnStatus | null;
}

const SpeciesSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Species[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSpecies, setSelectedSpecies] = useState<Species | null>(null);

  // Debounce search suggestions
  React.useEffect(() => {
    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`http://localhost:8000/api/species/suggest?query=${encodeURIComponent(query)}`);
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data || []);
          setShowSuggestions(true);
        }
      } catch (err) {
        console.error("Failed to fetch suggestions", err);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSearch = async (e?: React.FormEvent, explicitQuery?: string) => {
    if (e) e.preventDefault();
    const searchQuery = explicitQuery || query;
    if (searchQuery.length < 2) return;

    setQuery(searchQuery);
    setShowSuggestions(false);
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`http://localhost:8000/api/species/search?query=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) {
        throw new Error('Search failed. Please try again.');
      }
      const data = await response.json();
      setResults(data.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
      setSelectedSpecies(null); // Reset detail view on new search
    }
  };

  const getDisplayName = (species: any) => {
    if (species.vernacularNames && species.vernacularNames.length > 0) {
      const engName = species.vernacularNames.find((n: any) => n.language === 'eng');
      if (engName) return engName.vernacularName;
      return species.vernacularNames[0].vernacularName;
    }
    return species.canonicalName || species.scientificName;
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="text-center space-y-4">
        <h2 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-500">
          Species Explorer
        </h2>
        <p className="text-slate-400 text-lg">
          Discover information about endangered and diverse species from the GBIF database.
        </p>
      </div>

      <form onSubmit={handleSearch} className="relative group z-50">
        <div className="absolute -inset-1 bg-gradient-to-r from-emerald-600 to-cyan-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
        <div className="relative flex items-center bg-slate-900 rounded-xl overflow-hidden border border-slate-800 focus-within:border-emerald-500 transition-all duration-300">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder="Search species name (e.g. Lion)..."
            className="flex-1 bg-transparent border-none focus:ring-0 text-slate-100 px-6 py-4 placeholder:text-slate-500 outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-4 font-bold transition-colors duration-300 disabled:bg-slate-700 disabled:text-slate-500"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>

        {/* Autocomplete Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleSearch(undefined, getDisplayName(suggestion))}
                className="w-full text-left px-6 py-3 hover:bg-slate-800 text-slate-300 hover:text-emerald-400 transition-colors border-b border-slate-800/50 last:border-0"
              >
                <div className="font-medium">
                  {getDisplayName(suggestion)}
                </div>
                <div className="text-xs text-slate-500 flex gap-2 mt-1">
                  <span className="italic">{suggestion.scientificName}</span>
                  <span>•</span>
                  <span className="uppercase">{suggestion.rank}</span>
                  {suggestion.kingdom && <span>• {suggestion.kingdom}</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </form>

      {error && (
        <div className="p-4 bg-red-900/30 border border-red-500/50 rounded-xl text-red-400 text-center animate-pulse">
          {error}
        </div>
      )}

      {selectedSpecies && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-700">
          <SpeciesTracker 
            usageKey={selectedSpecies.key} 
            commonName={getDisplayName(selectedSpecies)}
            onClose={() => setSelectedSpecies(null)}
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {results.map((species) => (
          <div
            key={species.key}
            className="group relative bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6 hover:border-emerald-500/50 transition-all duration-500 hover:shadow-[0_0_30px_-10px_rgba(16,185,129,0.3)]"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-100 group-hover:text-emerald-400 transition-colors">
                  {getDisplayName(species)}
                </h3>
                <p className="text-sm text-slate-500 italic">{species.scientificName}</p>
              </div>
              <div className="flex flex-col gap-2 items-end">
                <span className="px-3 py-1 rounded-full bg-slate-800 text-emerald-400 text-xs font-semibold border border-emerald-500/20">
                  {species.rank}
                </span>
                {species.iucnRedListStatus && (
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                    ['EX', 'EW', 'CR', 'EN', 'VU'].includes(species.iucnRedListStatus.code) 
                      ? 'bg-red-900/30 text-red-400 border-red-500/30' 
                      : 'bg-emerald-900/30 text-emerald-400 border-emerald-500/30'
                  }`}>
                    {species.iucnRedListStatus.category}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <span className="text-slate-500 block">Kingdom</span>
                <span className="text-slate-300 font-medium">{species.kingdom || 'Unknown'}</span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 block">Family</span>
                <span className="text-slate-300 font-medium">{species.family || 'Unknown'}</span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 block">Taxonomy</span>
                <span className={`font-medium ${species.taxonomicStatus === 'ACCEPTED' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {species.taxonomicStatus || 'Unknown'}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 block">Genus</span>
                <span className="text-slate-300 font-medium">{species.genus || 'Unknown'}</span>
              </div>
            </div>
            
            <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
                <button 
                  onClick={() => setSelectedSpecies(species)}
                  className="text-emerald-500 text-sm font-black uppercase tracking-widest hover:text-emerald-400 flex items-center gap-2 group/btn"
                >
                    View live tracker stats 
                    <span className="group-hover/btn:translate-x-1 transition-transform">→</span>
                </button>
            </div>
          </div>
        ))}
      </div>

      {!loading && results.length === 0 && query.length >= 2 && (
        <div className="text-center py-20 bg-slate-900/20 border border-dashed border-slate-800 rounded-3xl">
          <p className="text-slate-500">No species found matching your search.</p>
        </div>
      )}
    </div>
  );
};

export default SpeciesSearch;
