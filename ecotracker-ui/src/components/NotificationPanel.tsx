import React, { useEffect, useRef, useState } from 'react';
import { apiRequest, type AppNotification } from '../api';

interface NotificationPanelProps {
  token: string;
}

const typeIcon: Record<string, string> = {
  system: '🔔',
  watchlist_update: '📋',
  status_change: '⚠️',
  new_sighting: '🌿',
};

const typeColor: Record<string, string> = {
  system: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20',
  watchlist_update: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  status_change: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  new_sighting: 'text-green-300 bg-green-500/10 border-green-500/20',
};

const NotificationPanel: React.FC<NotificationPanelProps> = ({ token }) => {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Poll for unread count every 30s
  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const data = await apiRequest<{ unread_count: number }>('/notifications/unread-count', { token });
        setUnreadCount(data.unread_count);
      } catch {
        // silent
      }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [token]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const openPanel = async () => {
    setOpen(true);
    if (notifications.length === 0) {
      setLoading(true);
      try {
        const data = await apiRequest<{ notifications: AppNotification[]; unread_count: number }>(
          '/notifications',
          { token }
        );
        setNotifications(data.notifications);
        setUnreadCount(data.unread_count);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
  };

  const markRead = async (id: number) => {
    try {
      await apiRequest(`/notifications/${id}/read`, { method: 'PATCH', token });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // silent
    }
  };

  const markAllRead = async () => {
    try {
      await apiRequest('/notifications/mark-all-read', { method: 'POST', token });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // silent
    }
  };

  const deleteNotification = async (id: number) => {
    try {
      await apiRequest(`/notifications/${id}`, { method: 'DELETE', token });
      const removed = notifications.find((n) => n.id === id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (removed && !removed.is_read) setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // silent
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={openPanel}
        className="relative flex items-center justify-center w-8 h-8 rounded-full border border-white/8 bg-white/[0.03] text-slate-400 hover:text-slate-100 hover:bg-white/[0.06] transition-all"
        title="Notifications"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-4 h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-black px-1 shadow-lg">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-slate-900/98 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl z-[200] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
            <div>
              <h3 className="text-sm font-bold text-white">Notifications</h3>
              {unreadCount > 0 && (
                <p className="text-[10px] text-slate-400">{unreadCount} unread</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-[10px] text-emerald-400 hover:text-emerald-300 font-semibold uppercase tracking-wide"
                >
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-500 hover:text-white transition-colors text-lg leading-none"
              >
                ×
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="max-h-96 overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="text-3xl mb-2">🔔</div>
                <p className="text-slate-400 text-sm">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`relative px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors ${
                    !notif.is_read ? 'bg-emerald-500/5' : ''
                  }`}
                >
                  {!notif.is_read && (
                    <div className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  )}
                  <div className="flex items-start gap-3 pl-2">
                    <span className={`flex-shrink-0 text-sm px-2 py-1 rounded-lg border ${typeColor[notif.type] || typeColor.system}`}>
                      {typeIcon[notif.type] || '🔔'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-white leading-tight">{notif.title}</p>
                        <span className="text-[10px] text-slate-500 flex-shrink-0">{formatTime(notif.created_at)}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{notif.message}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        {!notif.is_read && (
                          <button
                            type="button"
                            onClick={() => markRead(notif.id)}
                            className="text-[10px] text-emerald-400 hover:text-emerald-300"
                          >
                            Mark read
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => deleteNotification(notif.id)}
                          className="text-[10px] text-slate-500 hover:text-red-400"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationPanel;
