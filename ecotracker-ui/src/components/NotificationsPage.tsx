import React, { useEffect, useMemo, useState } from 'react';
import { apiRequest, type AppNotification } from '../api';

interface NotificationsPageProps {
  token: string;
  onOpenNotification: (notification: AppNotification) => void;
}

const typeLabels: Record<AppNotification['type'], string> = {
  watchlist_add: 'Watchlist',
  watchlist_update: 'Species update',
  status_change: 'Status change',
  new_sighting: 'New sighting',
  system: 'Admin',
  email_test: 'Email test',
};

const typeClass: Record<AppNotification['type'], string> = {
  watchlist_add: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
  watchlist_update: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
  status_change: 'border-amber-400/20 bg-amber-400/10 text-amber-200',
  new_sighting: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-200',
  system: 'border-violet-400/20 bg-violet-400/10 text-violet-200',
  email_test: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-200',
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));

const NotificationsPage: React.FC<NotificationsPageProps> = ({ token, onOpenNotification }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.is_read).length,
    [notifications]
  );

  const visibleNotifications = useMemo(
    () => notifications.filter((notification) => filter === 'all' || !notification.is_read),
    [filter, notifications]
  );

  useEffect(() => {
    const loadNotifications = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiRequest<{ notifications: AppNotification[]; unread_count: number }>(
          '/notifications',
          { token }
        );
        setNotifications(data.notifications);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load notifications.');
      } finally {
        setLoading(false);
      }
    };

    loadNotifications();
  }, [token]);

  const markRead = async (notification: AppNotification) => {
    if (notification.is_read) return { ...notification, is_read: true };

    await apiRequest(`/notifications/${notification.id}/read`, { method: 'PATCH', token });
    const updated = { ...notification, is_read: true };
    setNotifications((prev) => prev.map((item) => (item.id === notification.id ? updated : item)));
    return updated;
  };

  const openNotification = async (notification: AppNotification) => {
    try {
      const updated = await markRead(notification);
      onOpenNotification(updated);
    } catch {
      onOpenNotification(notification);
    }
  };

  const markAllRead = async () => {
    try {
      await apiRequest('/notifications/mark-all-read', { method: 'POST', token });
      setNotifications((prev) => prev.map((notification) => ({ ...notification, is_read: true })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark notifications as read.');
    }
  };

  const deleteNotification = async (id: number) => {
    try {
      await apiRequest(`/notifications/${id}`, { method: 'DELETE', token });
      setNotifications((prev) => prev.filter((notification) => notification.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete notification.');
    }
  };

  const clearAllNotifications = async () => {
    if (notifications.length === 0) return;
    const confirmed = window.confirm('Clear all notifications? This cannot be undone.');
    if (!confirmed) return;

    try {
      await apiRequest('/notifications', { method: 'DELETE', token });
      setNotifications([]);
      setFilter('all');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear notifications.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
      <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-300">Notification center</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-white">Notifications</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Review species changes, watchlist activity, new sightings, and admin broadcasts in one place.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`rounded-full px-4 py-2 text-xs font-bold transition-colors ${
              filter === 'all' ? 'bg-emerald-400 text-slate-950' : 'border border-white/10 text-slate-300 hover:bg-white/[0.05]'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setFilter('unread')}
            className={`rounded-full px-4 py-2 text-xs font-bold transition-colors ${
              filter === 'unread' ? 'bg-emerald-400 text-slate-950' : 'border border-white/10 text-slate-300 hover:bg-white/[0.05]'
            }`}
          >
            Unread {unreadCount > 0 ? unreadCount : ''}
          </button>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-4 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-400/15 transition-colors"
            >
              Mark all read
            </button>
          )}
          {notifications.length > 0 && (
            <button
              type="button"
              onClick={clearAllNotifications}
              className="rounded-full border border-red-400/25 bg-red-400/10 px-4 py-2 text-xs font-bold text-red-200 hover:bg-red-400/15 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-5 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="rounded-3xl border border-white/8 bg-slate-900/45 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
          </div>
        ) : visibleNotifications.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-sm font-black text-slate-500">
              0
            </div>
            <h2 className="mt-4 text-lg font-bold text-white">No notifications found</h2>
            <p className="mt-2 text-sm text-slate-400">
              {filter === 'unread' ? 'You have no unread notifications.' : 'New alerts will appear here.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/6">
            {visibleNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`group grid gap-4 px-5 py-4 transition-colors hover:bg-white/[0.035] md:grid-cols-[1fr_auto] md:items-center ${
                  !notification.is_read ? 'bg-emerald-400/[0.035]' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => openNotification(notification)}
                  className="min-w-0 text-left"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {!notification.is_read && <span className="h-2 w-2 rounded-full bg-emerald-300" />}
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${typeClass[notification.type] || typeClass.system}`}>
                      {typeLabels[notification.type] || 'Notification'}
                    </span>
                    <span className="text-xs text-slate-500">{formatDate(notification.created_at)}</span>
                  </div>
                  <h2 className="mt-3 text-base font-bold text-white group-hover:text-emerald-100 transition-colors">
                    {notification.title}
                  </h2>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-400">
                    {notification.message}
                  </p>
                </button>

                <div className="flex items-center gap-3 md:justify-end">
                  <button
                    type="button"
                    onClick={() => openNotification(notification)}
                    className="rounded-full border border-white/10 px-4 py-2 text-xs font-bold text-slate-200 hover:border-emerald-400/35 hover:text-emerald-200 transition-colors"
                  >
                    View details
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteNotification(notification.id)}
                    className="text-xs font-semibold text-slate-500 hover:text-red-300 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
