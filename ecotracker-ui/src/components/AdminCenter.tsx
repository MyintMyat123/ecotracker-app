import React, { useEffect, useState, useCallback } from 'react';
import { API_BASE_URL, apiRequest, type AdminUser, type AdminStats } from '../api';
import type { Species } from './SpeciesSearch';

interface AdminCenterProps {
  token: string;
}

type AdminTab = 'dashboard' | 'users' | 'broadcast';

interface SpeciesAttachment {
  gbif_species_key: number;
  common_name: string | null;
  scientific_name: string;
  conservation_status: string | null;
}

const statusColors: Record<string, string> = {
  'Critically Endangered': 'bg-red-500/15 text-red-300 border-red-500/25',
  'Endangered': 'bg-orange-500/15 text-orange-300 border-orange-500/25',
  'Vulnerable': 'bg-amber-500/15 text-amber-300 border-amber-500/25',
  'Near Threatened': 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25',
  'Least Concern': 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
};

const AdminCenter: React.FC<AdminCenterProps> = ({ token }) => {
  const [tab, setTab] = useState<AdminTab>('dashboard');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pagination, setPagination] = useState<{ current_page: number; last_page: number; total: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [recipientQuery, setRecipientQuery] = useState('');
  const [recipientSuggestions, setRecipientSuggestions] = useState<AdminUser[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<AdminUser[]>([]);
  const [speciesQuery, setSpeciesQuery] = useState('');
  const [speciesSuggestions, setSpeciesSuggestions] = useState<Species[]>([]);
  const [attachedSpecies, setAttachedSpecies] = useState<SpeciesAttachment[]>([]);
  const [broadcastStatus, setBroadcastStatus] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<AdminStats>('/admin/stats', { token });
      setStats(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadUsers = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (searchQuery) params.set('search', searchQuery);
      if (roleFilter) params.set('role', roleFilter);
      const data = await apiRequest<{ data: AdminUser[]; current_page: number; last_page: number; total: number }>(
        `/admin/users?${params}`,
        { token }
      );
      setUsers(data.data);
      setPagination({ current_page: data.current_page, last_page: data.last_page, total: data.total });
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [token, searchQuery, roleFilter]);

  useEffect(() => {
    if (tab === 'dashboard') loadStats();
    if (tab === 'users') loadUsers();
  }, [tab, loadStats, loadUsers]);

  const getSpeciesDisplayName = (species: Species) => {
    const s = species as Species & { vernacularNames?: Array<{ language: string; vernacularName: string }> };
    const english = s.vernacularNames?.find((name) => name.language === 'eng');
    return english?.vernacularName || s.vernacularNames?.[0]?.vernacularName || species.canonicalName || species.scientificName;
  };

  useEffect(() => {
    if (tab !== 'broadcast' || recipientQuery.trim().length < 2) {
      setRecipientSuggestions([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ search: recipientQuery.trim(), page: '1' });
        const data = await apiRequest<{ data: AdminUser[] }>(`/admin/users?${params}`, { token });
        setRecipientSuggestions(
          (data.data || []).filter((user) => !selectedRecipients.some((selected) => selected.id === user.id))
        );
      } catch {
        setRecipientSuggestions([]);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [recipientQuery, selectedRecipients, tab, token]);

  useEffect(() => {
    if (tab !== 'broadcast' || speciesQuery.trim().length < 2) {
      setSpeciesSuggestions([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/species/suggest?query=${encodeURIComponent(speciesQuery.trim())}`);
        if (!response.ok) throw new Error('Species suggestion failed');
        const data = await response.json();
        setSpeciesSuggestions(
          (data || []).filter((species: Species) =>
            !attachedSpecies.some((attached) => attached.gbif_species_key === species.key)
          )
        );
      } catch {
        setSpeciesSuggestions([]);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [attachedSpecies, speciesQuery, tab]);

  const addRecipient = (user: AdminUser) => {
    setSelectedRecipients((prev) => (prev.some((selected) => selected.id === user.id) ? prev : [...prev, user]));
    setRecipientQuery('');
    setRecipientSuggestions([]);
  };

  const addSpeciesAttachment = (species: Species) => {
    const attachment: SpeciesAttachment = {
      gbif_species_key: species.key,
      common_name: getSpeciesDisplayName(species),
      scientific_name: species.scientificName,
      conservation_status: species.iucnRedListStatus?.code ?? null,
    };

    setAttachedSpecies((prev) =>
      prev.some((item) => item.gbif_species_key === attachment.gbif_species_key) ? prev : [...prev, attachment]
    );
    setSpeciesQuery('');
    setSpeciesSuggestions([]);
  };

  const updateUser = async (id: number, changes: Partial<AdminUser>) => {
    setActionLoading(id);
    try {
      await apiRequest(`/admin/users/${id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify(changes),
      });
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...changes } : u)));
      if (selectedUser?.id === id) setSelectedUser((u) => u ? { ...u, ...changes } : u);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setActionLoading(null);
    }
  };

  const deleteUser = async (id: number) => {
    if (!confirm('Are you sure you want to delete this user? This cannot be undone.')) return;
    setActionLoading(id);
    try {
      await apiRequest(`/admin/users/${id}`, { method: 'DELETE', token });
      setUsers((prev) => prev.filter((u) => u.id !== id));
      if (selectedUser?.id === id) setSelectedUser(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setActionLoading(null);
    }
  };

  const sendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setBroadcastStatus(null);
    try {
      const body: Record<string, unknown> = { title: broadcastTitle, message: broadcastMessage };
      if (selectedRecipients.length > 0) body.user_ids = selectedRecipients.map((user) => user.id);
      if (attachedSpecies.length > 0) body.species = attachedSpecies;
      const res = await apiRequest<{ message: string }>('/admin/notifications/broadcast', {
        method: 'POST',
        token,
        body: JSON.stringify(body),
      });
      setBroadcastStatus(res.message);
      setBroadcastTitle('');
      setBroadcastMessage('');
      setRecipientQuery('');
      setSelectedRecipients([]);
      setRecipientSuggestions([]);
      setSpeciesQuery('');
      setAttachedSpecies([]);
      setSpeciesSuggestions([]);
    } catch (err) {
      setBroadcastStatus(err instanceof Error ? err.message : 'Failed to send');
    }
  };

  const tabClass = (t: AdminTab) =>
    `px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] rounded-full transition-all ${
      tab === t
        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
        : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
    }`;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-1 rounded-full bg-red-500/15 text-red-300 border border-red-500/25 text-[10px] font-black uppercase tracking-[0.2em]">
              Admin
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white">Admin Center</h1>
          <p className="text-slate-400 text-sm mt-1">Manage users, monitor activity, and send notifications</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={() => setTab('dashboard')} className={tabClass('dashboard')}>Dashboard</button>
        <button type="button" onClick={() => setTab('users')} className={tabClass('users')}>Users</button>
        <button type="button" onClick={() => setTab('broadcast')} className={tabClass('broadcast')}>Broadcast</button>
      </div>

      {/* Dashboard Tab */}
      {tab === 'dashboard' && (
        <div className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : stats ? (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {[
                  { label: 'Total Users', value: stats.stats.total_users, color: 'text-white' },
                  { label: 'Active Users', value: stats.stats.active_users, color: 'text-emerald-300' },
                  { label: 'Admin Users', value: stats.stats.admin_users, color: 'text-red-300' },
                  { label: 'Watchlist Items', value: stats.stats.total_watchlist, color: 'text-cyan-300' },
                  { label: 'New This Week', value: stats.stats.recent_users, color: 'text-amber-300' },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-white/8 bg-slate-950/55 backdrop-blur-xl p-4">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500 font-semibold">{stat.label}</p>
                    <div className={`text-3xl font-black mt-2 ${stat.color}`}>{stat.value.toLocaleString()}</div>
                  </div>
                ))}
              </div>

              {/* Top Species + Status Distribution */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-white/8 bg-slate-950/55 backdrop-blur-xl p-5">
                  <h3 className="text-sm font-bold text-white mb-4">Most Watched Species</h3>
                  <div className="space-y-2">
                    {stats.top_species.slice(0, 8).map((sp, i) => (
                      <div key={sp.gbif_species_key} className="flex items-center gap-3">
                        <span className="text-[10px] text-slate-500 w-4 font-bold">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white font-medium truncate">{sp.common_name || sp.scientific_name}</p>
                          <p className="text-[10px] text-slate-500 italic truncate">{sp.scientific_name}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {sp.conservation_status_label && (
                            <span className={`text-[9px] px-2 py-0.5 rounded-full border font-bold ${statusColors[sp.conservation_status_label] || 'bg-white/5 text-slate-400 border-white/10'}`}>
                              {sp.conservation_status_label}
                            </span>
                          )}
                          <span className="text-xs text-emerald-300 font-bold">{sp.watch_count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/8 bg-slate-950/55 backdrop-blur-xl p-5">
                  <h3 className="text-sm font-bold text-white mb-4">Watchlist by Conservation Status</h3>
                  <div className="space-y-3">
                    {stats.status_dist.map((item) => {
                      const maxCount = Math.max(...stats.status_dist.map((s) => s.count));
                      const pct = Math.round((item.count / maxCount) * 100);
                      return (
                        <div key={item.conservation_status_label}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-300">{item.conservation_status_label}</span>
                            <span className="text-slate-400">{item.count}</span>
                          </div>
                          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full transition-all duration-700"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* Users Tab */}
      {tab === 'users' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadUsers()}
              className="flex-1 bg-slate-900/80 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
            />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-slate-900/80 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500/50"
            >
              <option value="">All Roles</option>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <button
              type="button"
              onClick={() => loadUsers()}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold rounded-xl transition-all"
            >
              Search
            </button>
          </div>

          {/* Users Table */}
          <div className="rounded-2xl border border-white/8 bg-slate-950/55 backdrop-blur-xl overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/8">
                      <th className="text-left px-4 py-3 text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold">ID</th>
                      <th className="text-left px-4 py-3 text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold">User</th>
                      <th className="text-left px-4 py-3 text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold">Role</th>
                      <th className="text-left px-4 py-3 text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold">Status</th>
                      <th className="text-left px-4 py-3 text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold">Watchlist</th>
                      <th className="text-left px-4 py-3 text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold">Joined</th>
                      <th className="text-right px-4 py-3 text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs text-slate-400">#{user.id}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-white font-medium">{user.name}</p>
                            <p className="text-slate-500 text-xs">{user.email}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${
                            user.role === 'admin'
                              ? 'bg-red-500/15 text-red-300 border-red-500/25'
                              : 'bg-white/5 text-slate-400 border-white/10'
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${
                            user.is_active
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25'
                              : 'bg-red-500/15 text-red-300 border-red-500/25'
                          }`}>
                            {user.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-300">{user.watchlists_count ?? 0}</td>
                        <td className="px-4 py-3 text-slate-400 text-xs">
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {actionLoading === user.id ? (
                              <div className="w-4 h-4 border border-emerald-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => updateUser(user.id, { role: user.role === 'admin' ? 'user' : 'admin' })}
                                  className="text-[10px] text-cyan-400 hover:text-cyan-300 font-semibold"
                                  title={user.role === 'admin' ? 'Demote to user' : 'Promote to admin'}
                                >
                                  {user.role === 'admin' ? 'Demote' : 'Promote'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateUser(user.id, { is_active: !user.is_active })}
                                  className={`text-[10px] font-semibold ${user.is_active ? 'text-amber-400 hover:text-amber-300' : 'text-emerald-400 hover:text-emerald-300'}`}
                                >
                                  {user.is_active ? 'Deactivate' : 'Activate'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteUser(user.id)}
                                  className="text-[10px] text-red-400 hover:text-red-300 font-semibold"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination */}
          {pagination && pagination.last_page > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400">{pagination.total} total users</p>
              <div className="flex gap-2">
                {Array.from({ length: pagination.last_page }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => loadUsers(page)}
                    className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all ${
                      page === pagination.current_page
                        ? 'bg-emerald-500 text-white'
                        : 'bg-white/5 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Broadcast Tab */}
      {tab === 'broadcast' && (
        <div className="max-w-4xl">
          <div className="rounded-2xl border border-white/8 bg-slate-950/55 backdrop-blur-xl p-6">
            <h3 className="text-lg font-bold text-white mb-2">Send Notification</h3>
            <p className="text-slate-400 text-sm mb-6">
              Send an admin broadcast to all active users, or select specific recipients and attach relevant species records.
            </p>

            <form onSubmit={sendBroadcast} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-[0.2em] mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  required
                  placeholder="Notification title..."
                  className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-[0.2em] mb-2">
                  Message
                </label>
                <textarea
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  required
                  rows={4}
                  placeholder="Notification message..."
                  className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-[0.2em] mb-2">
                  Recipients
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={recipientQuery}
                    onChange={(e) => setRecipientQuery(e.target.value)}
                    placeholder="Search users by name or email. Leave empty to broadcast to all active users."
                    className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
                  />
                  {recipientSuggestions.length > 0 && (
                    <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-white/10 bg-slate-950 shadow-2xl">
                      {recipientSuggestions.slice(0, 8).map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => addRecipient(user)}
                          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.05] transition-colors"
                        >
                          <span>
                            <span className="block text-sm font-semibold text-slate-100">{user.name}</span>
                            <span className="block text-xs text-slate-500">{user.email}</span>
                          </span>
                          <span className="font-mono text-[11px] text-emerald-300">#{user.id}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedRecipients.length === 0 ? (
                    <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-200">
                      All active users
                    </span>
                  ) : (
                    selectedRecipients.map((user) => (
                      <span
                        key={user.id}
                        className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-100"
                      >
                        #{user.id} {user.name}
                        <button
                          type="button"
                          onClick={() => setSelectedRecipients((prev) => prev.filter((item) => item.id !== user.id))}
                          className="text-emerald-200/70 hover:text-white"
                          aria-label={`Remove ${user.name}`}
                        >
                          x
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-[0.2em] mb-2">
                  Attached species
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={speciesQuery}
                    onChange={(e) => setSpeciesQuery(e.target.value)}
                    placeholder="Search species to attach to this broadcast..."
                    className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
                  />
                  {speciesSuggestions.length > 0 && (
                    <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-white/10 bg-slate-950 shadow-2xl">
                      {speciesSuggestions.slice(0, 8).map((species) => (
                        <button
                          key={species.key}
                          type="button"
                          onClick={() => addSpeciesAttachment(species)}
                          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.05] transition-colors"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-slate-100">{getSpeciesDisplayName(species)}</span>
                            <span className="block truncate text-xs italic text-slate-500">{species.scientificName}</span>
                          </span>
                          {species.iucnRedListStatus?.code && (
                            <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-[10px] font-bold text-amber-200">
                              {species.iucnRedListStatus.code}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {attachedSpecies.length > 0 && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {attachedSpecies.map((species) => (
                      <div
                        key={species.gbif_species_key}
                        className="flex items-start justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-bold text-white">{species.common_name || species.scientific_name}</span>
                          <span className="block truncate text-[11px] italic text-slate-500">{species.scientific_name}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setAttachedSpecies((prev) => prev.filter((item) => item.gbif_species_key !== species.gbif_species_key))}
                          className="text-xs font-bold text-slate-500 hover:text-red-300"
                          aria-label={`Remove ${species.common_name || species.scientific_name}`}
                        >
                          x
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {broadcastStatus && (
                <div className={`px-4 py-3 rounded-xl text-sm ${
                  broadcastStatus.includes('sent') || broadcastStatus.includes('Notification')
                    ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                    : 'bg-red-500/10 text-red-300 border border-red-500/20'
                }`}>
                  {broadcastStatus}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-xl transition-all"
              >
                {selectedRecipients.length > 0 ? `Send to ${selectedRecipients.length} selected user(s)` : 'Broadcast to All Active Users'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCenter;
