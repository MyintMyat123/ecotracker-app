import { useEffect, useState } from 'react';
import './App.css';
import { apiRequest, TOKEN_STORAGE_KEY, type AuthUser, type WatchlistItem, type WatchlistPayload } from './api';
import AuthPanel from './components/AuthPanel';
import SpeciesSearch from './components/SpeciesSearch';
import TrackerPage from './components/TrackerPage';
import WatchlistPage from './components/WatchlistPage';

type Page = 'home' | 'tracker' | 'watchlist' | 'signin' | 'signup';

interface TrackerSelection {
  usageKey: number;
  commonName: string;
}

function App() {
  const [page, setPage] = useState<Page>('home');
  const [selectedTrackerSpecies, setSelectedTrackerSpecies] = useState<TrackerSelection | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_STORAGE_KEY));
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<number | null>(null);
  const [removingKey, setRemovingKey] = useState<number | null>(null);

  const signedIn = Boolean(user && token);

  const loadWatchlist = async (authToken: string) => {
    const items = await apiRequest<WatchlistItem[]>('/watchlist', { token: authToken });
    setWatchlist(items);
  };

  useEffect(() => {
    if (!token) return;

    const restoreSession = async () => {
      try {
        const result = await apiRequest<{ user: AuthUser }>('/auth/me', { token });
        setUser(result.user);
        await loadWatchlist(token);
      } catch {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        setToken(null);
        setUser(null);
        setWatchlist([]);
      }
    };

    restoreSession();
  }, [token]);

  const handleAuthenticated = async (nextUser: AuthUser, nextToken: string) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, nextToken);
    setUser(nextUser);
    setToken(nextToken);
    setWatchlistError(null);
    await loadWatchlist(nextToken);
    setPage('home');
  };

  const handleSignOut = async () => {
    if (token) {
      try {
        await apiRequest('/auth/logout', { method: 'POST', token });
      } catch {
        // Local sign-out still clears the stale token.
      }
    }

    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
    setWatchlist([]);
    setPage('home');
  };

  const addToWatchlist = async (payload: WatchlistPayload) => {
    if (!token) {
      setWatchlistError('Please sign in before adding species to your watchlist.');
      setPage('signin');
      return;
    }

    setSavingKey(payload.gbif_species_key);
    setWatchlistError(null);

    try {
      const item = await apiRequest<WatchlistItem>('/watchlist', {
        method: 'POST',
        token,
        body: JSON.stringify(payload),
      });

      setWatchlist((current) => {
        const exists = current.some((saved) => saved.gbif_species_key === item.gbif_species_key);
        return exists
          ? current.map((saved) => (saved.gbif_species_key === item.gbif_species_key ? item : saved))
          : [item, ...current];
      });
    } catch (err) {
      setWatchlistError(err instanceof Error ? err.message : 'Unable to save this species.');
    } finally {
      setSavingKey(null);
    }
  };

  const removeFromWatchlist = async (gbifSpeciesKey: number) => {
    if (!token) return;

    setRemovingKey(gbifSpeciesKey);
    setWatchlistError(null);

    try {
      await apiRequest(`/watchlist/${gbifSpeciesKey}`, {
        method: 'DELETE',
        token,
      });
      setWatchlist((current) => current.filter((item) => item.gbif_species_key !== gbifSpeciesKey));
    } catch (err) {
      setWatchlistError(err instanceof Error ? err.message : 'Unable to remove this species.');
    } finally {
      setRemovingKey(null);
    }
  };

  const openTracker = (species: TrackerSelection) => {
    setSelectedTrackerSpecies(species);
    setPage('tracker');
  };

  const navButtonClass = (target: Page) =>
    `rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 ${
      page === target
        ? 'bg-white/10 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08)]'
        : 'text-slate-400 hover:text-white hover:bg-white/5'
    }`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.12),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(34,211,238,0.10),_transparent_26%),linear-gradient(180deg,_rgba(15,23,42,0.08),_transparent_35%)]" />

      <header className="sticky top-0 z-50 border-b border-white/8 bg-slate-950/75 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setPage('home')}
            className="flex items-center gap-3 bg-transparent border-0 p-0 text-left shadow-none"
            style={{ backgroundColor: 'transparent', border: '0', padding: 0, borderRadius: 0, boxShadow: 'none' }}
          >
            <span className="text-emerald-300 font-black text-lg tracking-tight leading-none">ET</span>
            <div className="leading-tight">
              <div className="text-[10px] uppercase tracking-[0.32em] text-emerald-300/80 font-semibold">EcoTracker</div>
              <span className="text-lg font-semibold tracking-tight text-white">Endangered Species Tracker</span>
            </div>
          </button>

          <nav className="hidden md:flex items-center gap-2 rounded-full border border-white/8 bg-white/5 p-1 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.8)]">
            <button type="button" onClick={() => setPage('home')} className={navButtonClass('home')}>
              Home
            </button>
            <button type="button" onClick={() => setPage('tracker')} className={navButtonClass('tracker')}>
              Tracker
            </button>
            <button type="button" onClick={() => setPage('watchlist')} className={navButtonClass('watchlist')}>
              Watchlist
            </button>
            {!signedIn && (
              <>
                <button type="button" onClick={() => setPage('signin')} className={navButtonClass('signin')}>
                  Sign In
                </button>
                <button type="button" onClick={() => setPage('signup')} className={navButtonClass('signup')}>
                  Sign Up
                </button>
              </>
            )}
          </nav>

          {signedIn ? (
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline text-xs text-slate-400 bg-white/5 border border-white/8 rounded-full px-3 py-2">
                {user?.name}
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 px-4 py-2 text-xs font-semibold tracking-wide transition-all"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="md:hidden flex gap-2">
              <button type="button" onClick={() => setPage('signin')} className="rounded-full bg-white/5 border border-white/10 px-3 py-2 text-xs text-slate-200 font-semibold">
                Sign In
              </button>
              <button type="button" onClick={() => setPage('signup')} className="rounded-full bg-emerald-400/15 border border-emerald-400/20 px-3 py-2 text-xs text-emerald-300 font-semibold">
                Sign Up
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-grow py-10 md:py-12 relative z-10">
        {watchlistError && (
          <div className="max-w-4xl mx-auto px-6 pb-4">
            <div className="text-sm text-amber-100 bg-amber-950/30 border border-amber-500/30 rounded-2xl px-4 py-3 backdrop-blur-md">
              {watchlistError}
            </div>
          </div>
        )}

        {page === 'home' && (
          <>
            <SpeciesSearch
              isAuthenticated={signedIn}
              watchlist={watchlist}
              savingKey={savingKey}
              removingKey={removingKey}
              onAddToWatchlist={addToWatchlist}
              onRemoveFromWatchlist={removeFromWatchlist}
              onViewTracker={openTracker}
            />
          </>
        )}

        {page === 'watchlist' && (
          <WatchlistPage
            items={watchlist}
            signedIn={signedIn}
            onBackHome={() => setPage('home')}
            onOpenTracker={openTracker}
            onRemove={removeFromWatchlist}
            removingKey={removingKey}
            onSignIn={() => setPage('signin')}
          />
        )}

        {page === 'tracker' && (
          <TrackerPage
            selectedSpecies={selectedTrackerSpecies}
            onSelectSpecies={openTracker}
            onBackHome={() => setPage('home')}
            isAuthenticated={signedIn}
            watchlist={watchlist}
            savingKey={savingKey}
            removingKey={removingKey}
            onAddToWatchlist={addToWatchlist}
            onRemoveFromWatchlist={removeFromWatchlist}
          />
        )}

        {page === 'signin' && (
          <AuthPanel
            mode="login"
            onSwitchMode={() => setPage('signup')}
            onAuthenticated={handleAuthenticated}
          />
        )}

        {page === 'signup' && (
          <AuthPanel
            mode="register"
            onSwitchMode={() => setPage('signin')}
            onAuthenticated={handleAuthenticated}
          />
        )}
      </main>

      <footer className="border-t border-white/8 py-8 bg-slate-950/70 backdrop-blur-xl relative z-10">
        <div className="max-w-7xl mx-auto px-4 text-center space-y-4">
          <p className="text-slate-500 text-sm">
            Powered by GBIF.org - Global Biodiversity Information Facility
          </p>
          <div className="flex justify-center space-x-6 text-slate-400">
            <span className="text-xs">(c) 2026 EcoTracker Project</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
