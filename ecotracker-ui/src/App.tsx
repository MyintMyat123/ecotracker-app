import { useState, useEffect, useCallback } from 'react';
import { apiRequest, TOKEN_STORAGE_KEY, type AppNotification, type AuthUser, type WatchlistItem, type WatchlistPayload } from './api';
import LandingHero from './components/LandingHero';
import SpeciesTracker from './components/SpeciesTracker';
import WatchlistPage from './components/WatchlistPage';
import CountryExplorer from './components/CountryExplorer';
import AdminCenter from './components/AdminCenter';
import NotificationPanel from './components/NotificationPanel';
import NotificationDetailPage from './components/NotificationDetailPage';
import NotificationsPage from './components/NotificationsPage';
import AuthModal from './components/AuthModal';
import AdvancedSpeciesSearch from './components/AdvancedSpeciesSearch';

type Page = 'home' | 'search' | 'tracker' | 'watchlist' | 'countries' | 'notifications' | 'admin' | 'notification';

interface TrackerTarget {
  usageKey: number;
  commonName: string;
}

function App() {
  const [page, setPage] = useState<Page>('home');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_STORAGE_KEY));
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [savingKey, setSavingKey] = useState<number | null>(null);
  const [removingKey, setRemovingKey] = useState<number | null>(null);
  const [trackerTarget, setTrackerTarget] = useState<TrackerTarget | null>(null);
  const [selectedNotification, setSelectedNotification] = useState<AppNotification | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#\/?/, ''));
    const notificationId = Number(params.get('notification') || hashParams.get('notification'));
    const speciesKey = Number(params.get('species') || hashParams.get('species'));
    const speciesName = params.get('name') || hashParams.get('name') || 'Tracked species';
    const deepLinkedPage = params.get('page') || hashParams.get('page');

    if (Number.isFinite(notificationId) && notificationId > 0) {
      if (!token) {
        setAuthModalMode('login');
        setAuthModalOpen(true);
        setPage('notifications');
        showToast('Sign in to view this notification.', 'error');
        return;
      }

      apiRequest<AppNotification>(`/notifications/${notificationId}`, { token })
        .then((notification) => {
          setSelectedNotification(notification);
          setTrackerTarget(null);
          setPage('notification');
          window.history.replaceState({}, document.title, window.location.pathname);
        })
        .catch((err) => {
          showToast(err instanceof Error ? err.message : 'Unable to open notification.', 'error');
          setPage('notifications');
        });
      return;
    }

    if (Number.isFinite(speciesKey) && speciesKey > 0) {
      setTrackerTarget({ usageKey: speciesKey, commonName: speciesName });
      setSelectedNotification(null);
      setPage('tracker');
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (deepLinkedPage === 'notifications') {
      setPage('notifications');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    apiRequest<{ user: AuthUser }>('/auth/me', { token })
      .then((data) => setUser(data.user))
      .catch(() => {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        setToken(null);
      });
  }, [token]);

  const loadWatchlist = useCallback(async () => {
    if (!token) {
      setWatchlist([]);
      return;
    }

    try {
      const data = await apiRequest<WatchlistItem[]>('/watchlist', { token });
      setWatchlist(data);
    } catch {
      /* silent */
    }
  }, [token]);

  useEffect(() => {
    loadWatchlist();
  }, [loadWatchlist]);

  const handleAuthSuccess = (newUser: AuthUser, newToken: string) => {
    setUser(newUser);
    setToken(newToken);
    localStorage.setItem(TOKEN_STORAGE_KEY, newToken);
    setAuthModalOpen(false);
    showToast(`Welcome, ${newUser.name}!`);
    loadWatchlist();
  };

  const handleLogout = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST', token });
    } catch {
      /* silent */
    }

    setUser(null);
    setToken(null);
    setWatchlist([]);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setPage('home');
    showToast('Signed out successfully.');
  };

  const handleAddToWatchlist = async (payload: WatchlistPayload) => {
    if (!token) {
      setAuthModalMode('login');
      setAuthModalOpen(true);
      return;
    }

    setSavingKey(payload.gbif_species_key);
    try {
      await apiRequest('/watchlist', { method: 'POST', token, body: JSON.stringify(payload) });
      await loadWatchlist();
      showToast(`${payload.common_name || payload.scientific_name} added to watchlist.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add to watchlist.', 'error');
    } finally {
      setSavingKey(null);
    }
  };

  const handleRemoveFromWatchlist = async (gbifSpeciesKey: number) => {
    if (!token) return;

    setRemovingKey(gbifSpeciesKey);
    try {
      await apiRequest(`/watchlist/${gbifSpeciesKey}`, { method: 'DELETE', token });
      setWatchlist((prev) => prev.filter((item) => item.gbif_species_key !== gbifSpeciesKey));
      showToast('Species removed from watchlist.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to remove.', 'error');
    } finally {
      setRemovingKey(null);
    }
  };

  const goToPage = (nextPage: Page) => {
    setPage(nextPage);
    if (nextPage !== 'tracker') setTrackerTarget(null);
    if (nextPage !== 'notification') setSelectedNotification(null);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleViewTracker = (species: TrackerTarget) => {
    setTrackerTarget(species);
    setSelectedNotification(null);
    setPage('tracker');
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenNotification = (notification: AppNotification) => {
    setSelectedNotification(notification);
    setTrackerTarget(null);
    setPage('notification');
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openSignIn = () => {
    setAuthModalMode('login');
    setAuthModalOpen(true);
  };

  const openSignUp = () => {
    setAuthModalMode('register');
    setAuthModalOpen(true);
  };

  const navItems = [
    { label: 'Explore', page: 'home' as Page },
    { label: 'Search', page: 'search' as Page },
    { label: 'Countries', page: 'countries' as Page },
    { label: 'Watchlist', page: 'watchlist' as Page, badge: watchlist.length > 0 ? watchlist.length : undefined },
    ...(token ? [{ label: 'Notifications', page: 'notifications' as Page }] : []),
    ...(user?.role === 'admin' ? [{ label: 'Admin', page: 'admin' as Page }] : []),
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[10000] px-5 py-3 rounded-full text-sm font-semibold shadow-2xl border transition-all duration-300 backdrop-blur-xl ${
          toast.type === 'success'
            ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/30'
            : 'bg-red-950/90 text-red-200 border-red-500/30'
        }`}>
          {toast.message}
        </div>
      )}

      <nav className="sticky top-0 z-[100] border-b border-white/8 bg-slate-950/92 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="flex items-center justify-between gap-5 h-14">
            <button type="button" onClick={() => goToPage('home')} className="flex items-center gap-3 group min-w-0">
              <div className="w-8 h-8 rounded-lg bg-emerald-400/10 border border-emerald-300/18 flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21c4.5-4.5 7.5-8.25 7.5-12A7.5 7.5 0 005.196 5.196C2.268 8.124 2.88 13.03 7.5 17.25M9 10.5c1.5.75 4.5.75 6 0" />
                </svg>
              </div>
              <div className="hidden sm:block text-left">
                <span className="text-white font-semibold text-sm tracking-tight">EcoTracker</span>
                <span className="block text-[8px] text-slate-500 uppercase tracking-[0.22em] -mt-0.5">Species Monitoring</span>
              </div>
            </button>

            <div className="hidden md:flex items-center gap-6">
              {navItems.map((item) => (
                <button
                  key={item.page}
                  type="button"
                  onClick={() => goToPage(item.page)}
                  className={`relative flex h-14 items-center gap-1.5 text-sm font-medium transition-colors ${
                    page === item.page
                      ? item.page === 'admin' ? 'text-red-200' : 'text-emerald-200'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {item.label}
                  {'badge' in item && item.badge !== undefined && (
                    <span className="min-w-4 h-4 px-1 flex items-center justify-center rounded-full bg-emerald-400/18 text-emerald-200 text-[9px] font-black">
                      {item.badge}
                    </span>
                  )}
                  {page === item.page && (
                    <span className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-full ${item.page === 'admin' ? 'bg-red-300' : 'bg-emerald-300'}`} />
                  )}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2.5">
              {token && <NotificationPanel token={token} onOpenNotification={handleOpenNotification} />}
              {user ? (
                <div className="flex items-center gap-2">
                  <div className="hidden sm:flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-full border border-white/8 bg-white/[0.03]">
                    <div className="w-5 h-5 rounded-full bg-emerald-400/14 flex items-center justify-center text-[9px] font-black text-emerald-200">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-slate-300 text-xs font-medium max-w-[110px] truncate">{user.name}</span>
                    {user.role === 'admin' && <span className="px-1.5 py-0.5 rounded-full bg-red-500/12 text-red-300 text-[8px] font-bold border border-red-500/18">Admin</span>}
                  </div>
                  <button type="button" onClick={handleLogout} className="hidden sm:block text-sm font-medium text-slate-400 hover:text-red-300 transition-colors">
                    Sign out
                  </button>
                </div>
              ) : (
                <div className="hidden sm:flex items-center gap-2">
                  <button type="button" onClick={openSignIn} className="text-sm font-medium text-slate-300 hover:text-white transition-colors">
                    Sign in
                  </button>
                  <button type="button" onClick={openSignUp} className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold rounded-full transition-all">
                    Sign up
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden w-9 h-9 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-all"
                aria-label="Open navigation menu"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/8 bg-slate-950/96 backdrop-blur-2xl">
            <div className="px-4 py-4 space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.page}
                  type="button"
                  onClick={() => goToPage(item.page)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    page === item.page ? 'bg-emerald-500/15 text-emerald-300' : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span>{item.label}</span>
                  {'badge' in item && item.badge !== undefined && <span className="text-xs text-emerald-300">{item.badge}</span>}
                </button>
              ))}
              <div className="border-t border-white/8 pt-3 mt-3">
                {user ? (
                  <div className="space-y-2">
                    <div className="px-4 py-2 text-sm text-slate-300">Signed in as <span className="font-semibold text-white">{user.name}</span></div>
                    <button type="button" onClick={handleLogout} className="w-full px-4 py-3 text-sm text-red-300 hover:bg-red-500/10 rounded-xl text-left transition-colors">
                      Sign out
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button type="button" onClick={openSignIn} className="flex-1 py-3 text-sm font-semibold text-slate-300 hover:text-white border border-white/10 rounded-xl transition-colors">
                      Sign in
                    </button>
                    <button type="button" onClick={openSignUp} className="flex-1 py-3 text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-400 rounded-xl transition-all">
                      Sign up
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>

      <main className="pb-16">
        {page === 'home' && (
          <LandingHero
            isAuthenticated={!!user}
            watchlist={watchlist}
            savingKey={savingKey}
            removingKey={removingKey}
            onAddToWatchlist={handleAddToWatchlist}
            onRemoveFromWatchlist={handleRemoveFromWatchlist}
            onViewTracker={handleViewTracker}
            onSignIn={openSignIn}
          />
        )}

        {page === 'search' && (
          <AdvancedSpeciesSearch
            isAuthenticated={!!user}
            watchlist={watchlist}
            savingKey={savingKey}
            removingKey={removingKey}
            onAddToWatchlist={handleAddToWatchlist}
            onRemoveFromWatchlist={handleRemoveFromWatchlist}
            onViewTracker={handleViewTracker}
          />
        )}

        {page === 'tracker' && trackerTarget && (
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-6">
              <button type="button" onClick={() => goToPage('home')} className="hover:text-white transition-colors">Explore</button>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
              <span className="text-slate-300">{trackerTarget.commonName}</span>
            </div>
            <SpeciesTracker
              usageKey={trackerTarget.usageKey}
              commonName={trackerTarget.commonName}
              onClose={() => goToPage('home')}
              isAuthenticated={!!user}
              isSaved={watchlist.some((item) => item.gbif_species_key === trackerTarget.usageKey)}
              saving={savingKey === trackerTarget.usageKey}
              removing={removingKey === trackerTarget.usageKey}
              onAddToWatchlist={handleAddToWatchlist}
              onRemoveFromWatchlist={handleRemoveFromWatchlist}
            />
          </div>
        )}

        {page === 'watchlist' && (
          <div className="py-8">
            <WatchlistPage
              items={watchlist}
              signedIn={!!user}
              onBackHome={() => goToPage('home')}
              onOpenTracker={handleViewTracker}
              onRemove={handleRemoveFromWatchlist}
              removingKey={removingKey}
              onSignIn={openSignIn}
            />
          </div>
        )}

        {page === 'countries' && (
          <div className="py-8">
            <CountryExplorer
              isAuthenticated={!!user}
              watchlist={watchlist}
              savingKey={savingKey}
              removingKey={removingKey}
              onAddToWatchlist={handleAddToWatchlist}
              onRemoveFromWatchlist={handleRemoveFromWatchlist}
              onViewTracker={handleViewTracker}
            />
          </div>
        )}

        {page === 'notifications' && token && (
          <NotificationsPage
            token={token}
            onOpenNotification={handleOpenNotification}
          />
        )}

        {page === 'notifications' && !token && (
          <div className="max-w-lg mx-auto px-4 py-20 text-center space-y-4">
            <h2 className="text-xl font-bold text-white">Sign in to view notifications</h2>
            <p className="text-slate-400">Your species alerts and admin broadcasts are tied to your account.</p>
            <button type="button" onClick={openSignIn} className="px-6 py-3 bg-emerald-500 text-white font-semibold rounded-full text-sm">
              Sign in
            </button>
          </div>
        )}

        {page === 'admin' && user?.role === 'admin' && token && (
          <div className="py-8"><AdminCenter token={token} /></div>
        )}

        {page === 'admin' && user?.role !== 'admin' && (
          <div className="max-w-lg mx-auto px-4 py-20 text-center space-y-4">
            <h2 className="text-xl font-bold text-white">Access Denied</h2>
            <p className="text-slate-400">You need admin privileges to access this section.</p>
            <button type="button" onClick={() => goToPage('home')} className="px-6 py-3 bg-emerald-500 text-white font-semibold rounded-full text-sm">
              Go Home
            </button>
          </div>
        )}

        {page === 'notification' && (
          <NotificationDetailPage
            notification={selectedNotification}
            onBack={() => goToPage(token ? 'notifications' : 'home')}
            onOpenTracker={handleViewTracker}
          />
        )}
      </main>

      <footer className="border-t border-white/6 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-emerald-400/12 border border-emerald-300/20 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21c4.5-4.5 7.5-8.25 7.5-12A7.5 7.5 0 005.196 5.196C2.268 8.124 2.88 13.03 7.5 17.25M9 10.5c1.5.75 4.5.75 6 0" />
                </svg>
              </div>
              <div>
                <span className="text-white font-bold text-sm">EcoTracker</span>
                <p className="text-slate-500 text-[10px]">Powered by GBIF - Global Biodiversity Information Facility</p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-xs text-slate-500">
              <a href="https://www.gbif.org" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-300 transition-colors">GBIF.org</a>
              <a href="https://www.iucnredlist.org" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-300 transition-colors">IUCN Red List</a>
              <span>© 2026 EcoTracker</span>
            </div>
          </div>
        </div>
      </footer>

      <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} onSuccess={handleAuthSuccess} defaultMode={authModalMode} />
    </div>
  );
}

export default App;
