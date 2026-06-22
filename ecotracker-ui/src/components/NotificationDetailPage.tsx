import React from 'react';
import type { AppNotification } from '../api';

interface NotificationDetailPageProps {
  notification: AppNotification | null;
  onBack: () => void;
  onOpenTracker: (species: { usageKey: number; commonName: string }) => void;
}

const typeMeta: Record<AppNotification['type'], { label: string; accent: string; badge: string }> = {
  watchlist_add: {
    label: 'Watchlist update',
    accent: 'text-emerald-200 border-emerald-400/25 bg-emerald-400/10',
    badge: 'bg-emerald-400/12 text-emerald-200 border-emerald-400/20',
  },
  watchlist_update: {
    label: 'Species update',
    accent: 'text-emerald-200 border-emerald-400/25 bg-emerald-400/10',
    badge: 'bg-emerald-400/12 text-emerald-200 border-emerald-400/20',
  },
  status_change: {
    label: 'Status change',
    accent: 'text-amber-200 border-amber-400/25 bg-amber-400/10',
    badge: 'bg-amber-400/12 text-amber-200 border-amber-400/20',
  },
  new_sighting: {
    label: 'New sighting',
    accent: 'text-cyan-200 border-cyan-400/25 bg-cyan-400/10',
    badge: 'bg-cyan-400/12 text-cyan-200 border-cyan-400/20',
  },
  system: {
    label: 'Admin broadcast',
    accent: 'text-violet-200 border-violet-400/25 bg-violet-400/10',
    badge: 'bg-violet-400/12 text-violet-200 border-violet-400/20',
  },
  email_test: {
    label: 'Email test',
    accent: 'text-cyan-200 border-cyan-400/25 bg-cyan-400/10',
    badge: 'bg-cyan-400/12 text-cyan-200 border-cyan-400/20',
  },
};

const statusLabels: Record<string, string> = {
  CR: 'Critically Endangered',
  EN: 'Endangered',
  VU: 'Vulnerable',
  NT: 'Near Threatened',
  LC: 'Least Concern',
  DD: 'Data Deficient',
  NE: 'Not Evaluated',
};

const normalizeData = (data: unknown): Record<string, unknown> => {
  if (!data) return {};
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return data as Record<string, unknown>;
};

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));

const formatKey = (key: string) =>
  key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return 'Not provided';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? value.map((item) => formatValue(item)).join(', ') : 'None';
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => `${formatKey(key)}: ${formatValue(item)}`)
      .join('\n');
  }
  return String(value);
};

const normalizeAttachedSpecies = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => item as Record<string, unknown>)
    .filter((item) => Number(item.gbif_species_key ?? item.species_key) > 0)
    .map((item) => ({
      gbif_species_key: Number(item.gbif_species_key ?? item.species_key),
      species_name: String(item.species_name ?? item.common_name ?? item.scientific_name ?? 'Attached species'),
      scientific_name: item.scientific_name ? String(item.scientific_name) : null,
      conservation_status: item.conservation_status ? String(item.conservation_status).toUpperCase() : null,
    }));
};

const NotificationDetailPage: React.FC<NotificationDetailPageProps> = ({ notification, onBack, onOpenTracker }) => {
  if (!notification) {
    return (
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-16 text-center">
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-8">
          <p className="text-sm font-semibold text-slate-300">No notification selected.</p>
          <button
            type="button"
            onClick={onBack}
            className="mt-5 inline-flex items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-400/10 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.16em] text-emerald-200 hover:bg-emerald-400/15 transition-colors"
          >
            Back to explore
          </button>
        </div>
      </div>
    );
  }

  const payload = normalizeData(notification.data);
  const meta = typeMeta[notification.type] || typeMeta.system;
  const speciesKey = Number(payload.gbif_species_key ?? payload.species_key ?? payload.usageKey ?? payload.taxonKey);
  const speciesName = String(payload.species_name ?? payload.common_name ?? payload.scientific_name ?? notification.title);
  const conservationStatus = typeof payload.conservation_status === 'string' ? payload.conservation_status.toUpperCase() : null;
  const changeSummary = Array.isArray(payload.change_summary) ? payload.change_summary.filter(Boolean).map(String) : [];
  const attachedSpecies = normalizeAttachedSpecies(payload.attached_species);
  const hiddenPayloadKeys = new Set(['change_summary', 'attached_species']);
  const payloadEntries = Object.entries(payload).filter(([key, value]) =>
    !hiddenPayloadKeys.has(key) && value !== null && value !== undefined && value !== ''
  );
  const isSpeciesNotice = Number.isFinite(speciesKey) && speciesKey > 0;

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
      <div className="flex items-center gap-2 text-xs text-slate-500 mb-6">
        <button type="button" onClick={onBack} className="hover:text-white transition-colors">Explore</button>
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
        <span className="text-slate-300">Notification detail</span>
      </div>

      <section className="rounded-3xl border border-white/8 bg-slate-900/55 overflow-hidden shadow-2xl">
        <div className="border-b border-white/8 bg-gradient-to-br from-white/[0.05] to-transparent p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5">
            <div className="space-y-4">
              <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${meta.badge}`}>
                {meta.label}
              </span>
              <div>
                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">{notification.title}</h1>
                <p className="mt-3 max-w-3xl text-sm md:text-base leading-7 text-slate-300">{notification.message}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-white/8 bg-slate-950/50 px-4 py-3 text-left md:text-right shrink-0">
              <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Received</p>
              <p className="mt-1 text-sm font-semibold text-slate-200">{formatDateTime(notification.created_at)}</p>
              <span className={`mt-3 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${
                notification.is_read
                  ? 'border-white/10 bg-white/[0.04] text-slate-400'
                  : 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200'
              }`}>
                {notification.is_read ? 'Read' : 'Unread'}
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-5 p-6 md:p-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className={`rounded-2xl border p-5 ${meta.accent}`}>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] opacity-80">
              {isSpeciesNotice ? 'Species context' : 'Broadcast context'}
            </p>
            <h2 className="mt-3 text-xl font-black text-white">
              {isSpeciesNotice ? speciesName : 'Administrative message'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {isSpeciesNotice
                ? 'This notification is linked to a tracked species record. Open the tracker to review its GBIF profile, sightings, map, and ecological notes.'
                : 'This notification was sent by the EcoTracker team or generated by the system.'}
            </p>
            {conservationStatus && (
              <div className="mt-4 inline-flex rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-200">
                {conservationStatus}: {statusLabels[conservationStatus] || 'Conservation status'}
              </div>
            )}
            {isSpeciesNotice && (
              <button
                type="button"
                onClick={() => onOpenTracker({ usageKey: speciesKey, commonName: speciesName })}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-emerald-400 px-5 py-2.5 text-xs font-black uppercase tracking-[0.16em] text-slate-950 hover:bg-emerald-300 transition-colors"
              >
                Open tracker
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </button>
            )}
          </div>

          <div className="rounded-2xl border border-white/8 bg-slate-950/45 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Notification metadata</p>
            <div className="mt-4 grid gap-3">
              <div className="flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
                <span className="text-xs text-slate-500">Type</span>
                <span className="text-xs font-bold text-slate-200">{meta.label}</span>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
                <span className="text-xs text-slate-500">Notification ID</span>
                <span className="text-xs font-bold text-slate-200">#{notification.id}</span>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
                <span className="text-xs text-slate-500">Last updated</span>
                <span className="text-xs font-bold text-slate-200">{formatDateTime(notification.updated_at)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-white/8 p-6 md:p-8">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Attached data</p>
              <h2 className="mt-1 text-lg font-bold text-white">Details from the notification payload</h2>
            </div>
          </div>

          {changeSummary.length > 0 && (
            <div className="mb-5 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200">What changed</p>
              <div className="mt-3 grid gap-2">
                {changeSummary.map((line, index) => (
                  <div key={`${line}-${index}`} className="rounded-xl border border-cyan-400/10 bg-slate-950/35 px-3 py-2 text-sm font-semibold text-cyan-50">
                    {line}
                  </div>
                ))}
              </div>
            </div>
          )}

          {attachedSpecies.length > 0 && (
            <div className="mb-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-200">Attached species</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {attachedSpecies.map((species) => (
                  <div key={species.gbif_species_key} className="rounded-xl border border-emerald-400/10 bg-slate-950/35 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-white">{species.species_name}</p>
                        {species.scientific_name && (
                          <p className="mt-1 truncate text-xs italic text-slate-400">{species.scientific_name}</p>
                        )}
                        {species.conservation_status && (
                          <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-200">
                            {species.conservation_status}: {statusLabels[species.conservation_status] || 'Conservation status'}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenTracker({ usageKey: species.gbif_species_key, commonName: species.species_name })}
                        className="shrink-0 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-200 hover:bg-emerald-400/15 transition-colors"
                      >
                        Tracker
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {payloadEntries.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {payloadEntries.map(([key, value]) => (
                <div key={key} className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{formatKey(key)}</p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm font-semibold text-slate-200">{formatValue(value)}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-sm text-slate-400">
              This notification does not include extra payload data.
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default NotificationDetailPage;
