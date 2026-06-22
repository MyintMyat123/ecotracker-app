import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import React, { useEffect, useState } from 'react';
import { API_BASE_URL, type WatchlistPayload } from '../api';
import EcologicalInsightPanel from './EcologicalInsightPanel';
import SpeciesMap from './SpeciesMap';

interface TrackerData {
  identity: {
    usageKey: number;
    scientificName: string;
    canonicalName: string;
    family: string;
    kingdom: string;
  };
  conservation: {
    status: string;
    statusLabel: string;
    isExtinct: boolean;
  };
  trackerStats: {
    globalSightings: number;
    sightingsThisYear: number;
    countriesObserved: string[];
    lastObserved: string | null;
  };
  monitoring: {
    yearlyTrend: {
      currentYear: number;
      currentYearCount: number;
      previousYearCount: number;
      changePercent: number;
      direction: 'up' | 'down' | 'stable';
      yearlyCounts: Array<{ year: number; count: number }>;
    };
    dataConfidence: {
      score: number;
      label: string;
      coordinateCoverage: number;
      photoEvidenceCount: number;
      photoCoverage: number;
      issueRate: number;
      topIssues: Array<{ name: string; count: number }>;
    };
    recordTypes: Array<{ name: string; count: number }>;
    seasonality: {
      peakMonth: string | null;
      peakCount: number;
      monthlyCounts: Array<{ month: number; label: string; count: number }>;
    };
  };
  threats: Array<{
    type: string;
    description: string;
  }>;
  images: string[];
  mapConfig: {
    taxonKey: number;
    tileUrl: string;
  };
}

interface SpeciesTrackerProps {
  usageKey: number;
  commonName: string;
  onClose: () => void;
  isAuthenticated: boolean;
  isSaved: boolean;
  saving: boolean;
  removing: boolean;
  onAddToWatchlist: (payload: WatchlistPayload) => void;
  onRemoveFromWatchlist: (gbifSpeciesKey: number) => void;
}

const IUCN_COLORS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  EX:  { bg: 'bg-gray-800/60',   text: 'text-gray-300',   border: 'border-gray-500/30',   label: 'Extinct' },
  EW:  { bg: 'bg-gray-800/60',   text: 'text-gray-300',   border: 'border-gray-500/30',   label: 'Extinct in Wild' },
  CR:  { bg: 'bg-red-900/40',    text: 'text-red-300',    border: 'border-red-500/30',    label: 'Critically Endangered' },
  EN:  { bg: 'bg-orange-900/40', text: 'text-orange-300', border: 'border-orange-500/30', label: 'Endangered' },
  VU:  { bg: 'bg-amber-900/40',  text: 'text-amber-300',  border: 'border-amber-500/30',  label: 'Vulnerable' },
  NT:  { bg: 'bg-yellow-900/40', text: 'text-yellow-300', border: 'border-yellow-500/30', label: 'Near Threatened' },
  LC:  { bg: 'bg-emerald-900/40',text: 'text-emerald-300',border: 'border-emerald-500/30',label: 'Least Concern' },
  DD:  { bg: 'bg-slate-800/60',  text: 'text-slate-300',  border: 'border-slate-500/30',  label: 'Data Deficient' },
  NE:  { bg: 'bg-slate-800/60',  text: 'text-slate-300',  border: 'border-slate-500/30',  label: 'Not Evaluated' },
};

const threatTypeColors: Record<string, string> = {
  THREATS: 'text-red-300 bg-red-500/10 border-red-500/20',
  HABITAT: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  CONSERVATION: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20',
  CONSERVATION_MEASURES: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20',
  CONSERVATION_STATUS: 'text-blue-300 bg-blue-500/10 border-blue-500/20',
  MANAGEMENT: 'text-purple-300 bg-purple-500/10 border-purple-500/20',
  REPRODUCTION: 'text-pink-300 bg-pink-500/10 border-pink-500/20',
  ECOLOGY: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  DISTRIBUTION: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20',
  DESCRIPTION: 'text-slate-300 bg-slate-500/10 border-slate-500/20',
  DIAGNOSTIC: 'text-indigo-300 bg-indigo-500/10 border-indigo-500/20',
  LIFEFORM: 'text-lime-300 bg-lime-500/10 border-lime-500/20',
  LIFE_HISTORY: 'text-teal-300 bg-teal-500/10 border-teal-500/20',
  BEHAVIOUR: 'text-fuchsia-300 bg-fuchsia-500/10 border-fuchsia-500/20',
  USES: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  GENERAL: 'text-slate-300 bg-white/5 border-white/10',
};

const formatFacetName = (value: string) => value
  .replace(/_/g, ' ')
  .toLowerCase()
  .replace(/\b\w/g, (char) => char.toUpperCase());

const countryDisplayNames = typeof Intl !== 'undefined' && 'DisplayNames' in Intl
  ? new Intl.DisplayNames(['en'], { type: 'region' })
  : null;

const getCountryName = (code: string) => {
  try {
    return countryDisplayNames?.of(code.toUpperCase()) || code;
  } catch {
    return code;
  }
};

const SpeciesTracker: React.FC<SpeciesTrackerProps> = ({
  usageKey,
  commonName,
  onClose,
  isAuthenticated,
  isSaved,
  saving,
  removing,
  onAddToWatchlist,
  onRemoveFromWatchlist,
}) => {
  const [data, setData] = useState<TrackerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showAllCountries, setShowAllCountries] = useState(false);
  const [selectedMapCountries, setSelectedMapCountries] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'monitoring' | 'ecology' | 'gallery'>('monitoring');
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    const fetchTrackerData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/species/${usageKey}/tracker`);
        if (response.ok) {
          const result = await response.json();
          setData(result);
        } else {
          setError('Failed to initialize tracker data. The species might be missing monitoring metrics in the GBIF database.');
        }
      } catch {
        setError('Network error. Please check your connection to the monitoring server.');
      } finally {
        setLoading(false);
      }
    };
    fetchTrackerData();
  }, [usageKey]);

  useEffect(() => {
    setSelectedMapCountries([]);
    setShowAllCountries(false);
  }, [usageKey]);

  if (loading) {
    return (
      <div className="rounded-[2rem] p-12 border border-white/8 bg-slate-950/55 backdrop-blur-xl flex flex-col items-center justify-center space-y-4 min-h-[520px]">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-emerald-400/30 rounded-full" />
          <div className="absolute inset-0 w-16 h-16 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-emerald-300 font-bold tracking-[0.28em] uppercase text-xs">Loading species data</p>
        <p className="text-slate-500 text-xs">Fetching from GBIF database...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[2rem] p-12 border border-red-500/20 bg-slate-950/55 backdrop-blur-xl flex flex-col items-center justify-center space-y-6 min-h-[320px]">
        <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <div className="text-center">
          <h3 className="text-red-300 text-xl font-semibold">Tracker data unavailable</h3>
          <p className="text-slate-400 text-sm mt-2 max-w-md leading-relaxed">{error}</p>
        </div>
        <button onClick={onClose} className="rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white px-6 py-3 text-xs font-semibold uppercase tracking-[0.24em] transition-all">
          Return to explorer
        </button>
      </div>
    );
  }

  if (!data) return null;

  const iucnInfo = IUCN_COLORS[data.conservation.status] || IUCN_COLORS.NE;
  const isCritical = ['CR', 'EN', 'VU', 'EX', 'EW'].includes(data.conservation.status);

  const watchlistPayload: WatchlistPayload = {
    gbif_species_key: usageKey,
    common_name: commonName,
    scientific_name: data.identity.scientificName,
    conservation_status: data.conservation.status,
    conservation_status_label: data.conservation.statusLabel,
    family: data.identity.family,
    kingdom: data.identity.kingdom,
    image_url: data.images[0] ?? null,
    last_observed_at: data.trackerStats.lastObserved,
  };

  const threatGroups = Object.entries(
    data.threats.reduce((acc, threat) => {
      const type = threat.type.toUpperCase();
      if (!acc[type]) acc[type] = [];
      acc[type].push(threat.description);
      return acc;
    }, {} as Record<string, string[]>)
  );

  const displayedCountries = showAllCountries
    ? data.trackerStats.countriesObserved
    : data.trackerStats.countriesObserved.slice(0, 12);
  const toggleMapCountry = (country: string) => {
    const code = country.toUpperCase();
    setSelectedMapCountries((current) =>
      current.includes(code)
        ? current.filter((item) => item !== code)
        : [...current, code]
    );
  };
  const maxYearlyCount = Math.max(...data.monitoring.yearlyTrend.yearlyCounts.map((item) => item.count), 1);
  const maxMonthlyCount = Math.max(...data.monitoring.seasonality.monthlyCounts.map((item) => item.count), 1);
  const trendTone = data.monitoring.yearlyTrend.direction === 'up'
    ? 'text-emerald-300'
    : data.monitoring.yearlyTrend.direction === 'down'
      ? 'text-red-300'
      : 'text-slate-300';
  const trendLabel = data.monitoring.yearlyTrend.direction === 'up'
    ? 'Observation activity rising'
    : data.monitoring.yearlyTrend.direction === 'down'
      ? 'Observation activity declining'
      : 'Observation activity stable';
  const galleryImages = Array.from(new Set(data.images.filter(Boolean)));
  const reportFileName = `${(commonName || data.identity.canonicalName || 'species')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'species'}-report.html`;
  type PdfLine = { text: string; size?: number; bold?: boolean; gap?: number };
  const cleanPdfText = (value: string | number | null | undefined) =>
    String(value ?? '')
      .replace(/[–—]/g, '-')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  const escapePdfText = (value: string) =>
    cleanPdfText(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const wrapPdfText = (text: string, maxChars: number) => {
    const words = cleanPdfText(text).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = '';

    words.forEach((word) => {
      const next = current ? `${current} ${word}` : word;
      if (next.length > maxChars && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    });

    if (current) lines.push(current);
    return lines.length ? lines : [''];
  };
  const buildPdf = (lines: PdfLine[]) => {
    const pageWidth = 595;
    const pageHeight = 842;
    const margin = 48;
    const contentWidth = pageWidth - margin * 2;
    const pages: PdfLine[][] = [];
    let page: PdfLine[] = [];
    let y = pageHeight - margin;

    const pushPage = () => {
      pages.push(page);
      page = [];
      y = pageHeight - margin;
    };

    lines.forEach((line) => {
      const size = line.size ?? 10;
      const lineHeight = Math.max(13, size + 4);
      const gap = line.gap ?? 0;
      const maxChars = Math.max(32, Math.floor(contentWidth / (size * 0.52)));
      const wrapped = line.text === '' ? [''] : wrapPdfText(line.text, maxChars);

      wrapped.forEach((text, index) => {
        if (y - lineHeight < margin) pushPage();
        page.push({ ...line, text });
        y -= lineHeight;
        if (index === wrapped.length - 1 && gap) y -= gap;
      });
    });

    if (page.length) pages.push(page);

    const objects: string[] = [];
    const addObject = (content: string) => {
      objects.push(content);
      return objects.length;
    };
    const catalogId = addObject('<< /Type /Catalog /Pages 2 0 R >>');
    const pagesId = addObject('');
    const fontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    const boldFontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
    const pageIds: number[] = [];

    pages.forEach((pageLines, pageIndex) => {
      let cursorY = pageHeight - margin;
      const stream = pageLines.map((line) => {
        const size = line.size ?? 10;
        const lineHeight = Math.max(13, size + 4);
        cursorY -= lineHeight;
        const fontRef = line.bold ? 'F2' : 'F1';
        return `BT /${fontRef} ${size} Tf ${margin} ${cursorY.toFixed(2)} Td (${escapePdfText(line.text)}) Tj ET`;
      }).join('\n');
      const footer = `BT /F1 8 Tf ${pageWidth - margin - 70} 24 Td (Page ${pageIndex + 1} of ${pages.length}) Tj ET`;
      const fullStream = `${stream}\n${footer}`;
      const contentId = addObject(`<< /Length ${fullStream.length} >>\nstream\n${fullStream}\nendstream`);
      const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
      pageIds.push(pageId);
    });

    objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    objects.forEach((object, index) => {
      offsets.push(pdf.length);
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach((offset) => {
      pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
    });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return pdf;
  };
  void buildPdf;
  const downloadSpeciesReport = () => {
    const status = `${data.conservation.status} - ${data.conservation.statusLabel}`;
    const escapeHtml = (value: string | number | null | undefined) =>
      String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    const yearlyRows = data.monitoring.yearlyTrend.yearlyCounts
      .map((item) => `<tr><td>${escapeHtml(item.year)}</td><td>${escapeHtml(item.count.toLocaleString())}</td></tr>`)
      .join('');
    const monthlyRows = data.monitoring.seasonality.monthlyCounts
      .map((item) => `<tr><td>${escapeHtml(item.label)}</td><td>${escapeHtml(item.count.toLocaleString())}</td></tr>`)
      .join('');
    const evidenceRows = (data.monitoring.recordTypes.length > 0 ? data.monitoring.recordTypes : [{ name: 'Unknown', count: 0 }])
      .map((item) => `<tr><td>${escapeHtml(formatFacetName(item.name))}</td><td>${escapeHtml(item.count.toLocaleString())}</td></tr>`)
      .join('');
    const issueItems = data.monitoring.dataConfidence.topIssues.length
      ? data.monitoring.dataConfidence.topIssues.map((item) => `<li>${escapeHtml(formatFacetName(item.name))}: ${escapeHtml(item.count.toLocaleString())}</li>`).join('')
      : '<li>No major GBIF issues reported in the sampled facets.</li>';
    const countryItems = data.trackerStats.countriesObserved.length
      ? data.trackerStats.countriesObserved.map((country) => `<li>${escapeHtml(country)} - ${escapeHtml(getCountryName(country))}</li>`).join('')
      : '<li>No country facet data available.</li>';
    const ecologicalSections = threatGroups.length
      ? threatGroups.map(([type, descriptions]) => `
          <article class="note">
            <h3>${escapeHtml(formatFacetName(type))}</h3>
            ${descriptions.map((desc) => `<p>${escapeHtml(desc)}</p>`).join('')}
          </article>
        `).join('')
      : '<p>No ecological note sections are available for this species.</p>';
    const galleryMarkup = galleryImages.length
      ? galleryImages.map((img, index) => `
          <figure>
            <img src="${escapeHtml(img)}" alt="${escapeHtml(commonName)} photo ${index + 1}" />
            <figcaption>Photo ${index + 1}</figcaption>
          </figure>
        `).join('')
      : '<p>No field photos are available for this species.</p>';
    const lastObserved = data.trackerStats.lastObserved
      ? new Date(data.trackerStats.lastObserved).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : 'N/A';
    const generatedAt = new Date().toLocaleString();
    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(commonName)} Species Report</title>
  <style>
    body { margin: 0; background: #f7fafc; color: #0f172a; font-family: Inter, Segoe UI, Arial, sans-serif; line-height: 1.55; }
    main { max-width: 1040px; margin: 0 auto; padding: 36px 24px 56px; }
    header, section { background: #fff; border: 1px solid #dbe4ef; border-radius: 18px; padding: 24px; margin-bottom: 18px; box-shadow: 0 18px 45px rgba(15, 23, 42, 0.06); }
    h1, h2, h3 { margin: 0; line-height: 1.2; }
    h1 { font-size: 34px; }
    h2 { font-size: 22px; margin-bottom: 14px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; }
    h3 { font-size: 16px; margin-bottom: 8px; }
    .subtitle { color: #475569; font-style: italic; margin: 8px 0 0; }
    .meta { color: #64748b; font-size: 12px; margin-top: 14px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; }
    .metric { border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px; background: #f8fafc; }
    .metric span { display: block; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; }
    .metric strong { display: block; margin-top: 6px; font-size: 22px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 8px 6px; text-align: left; font-size: 14px; }
    ul { margin-top: 8px; }
    .note { border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px; background: #fbfdff; margin: 12px 0; }
    .gallery { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; }
    figure { margin: 0; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; background: #fff; }
    figure img { width: 100%; aspect-ratio: 1 / 1; object-fit: cover; display: block; }
    figcaption { padding: 8px 10px; color: #64748b; font-size: 12px; }
    @media print { body { background: #fff; } header, section { box-shadow: none; break-inside: avoid; } }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>${escapeHtml(commonName)}</h1>
      <p class="subtitle">${escapeHtml(data.identity.scientificName)}</p>
      <p class="meta">Generated by EcoTracker on ${escapeHtml(generatedAt)}. GBIF species key: ${escapeHtml(usageKey)}</p>
      <div class="grid" style="margin-top:18px">
        <div class="metric"><span>Conservation status</span><strong>${escapeHtml(status)}</strong></div>
        <div class="metric"><span>Family</span><strong>${escapeHtml(data.identity.family)}</strong></div>
        <div class="metric"><span>Kingdom</span><strong>${escapeHtml(data.identity.kingdom)}</strong></div>
        <div class="metric"><span>Last spotted</span><strong>${escapeHtml(lastObserved)}</strong></div>
      </div>
    </header>

    <section>
      <h2>Monitoring</h2>
      <div class="grid">
        <div class="metric"><span>Global sightings</span><strong>${escapeHtml(data.trackerStats.globalSightings.toLocaleString())}</strong></div>
        <div class="metric"><span>This year</span><strong>${escapeHtml(data.trackerStats.sightingsThisYear.toLocaleString())}</strong></div>
        <div class="metric"><span>Countries observed</span><strong>${escapeHtml(data.trackerStats.countriesObserved.length)}</strong></div>
        <div class="metric"><span>Data confidence</span><strong>${escapeHtml(data.monitoring.dataConfidence.label)} (${escapeHtml(data.monitoring.dataConfidence.score)})</strong></div>
      </div>
      <h3 style="margin-top:18px">Observation trend</h3>
      <p>${escapeHtml(trendLabel)}. ${escapeHtml(data.monitoring.yearlyTrend.currentYearCount.toLocaleString())} records in ${escapeHtml(data.monitoring.yearlyTrend.currentYear)}, compared with ${escapeHtml(data.monitoring.yearlyTrend.previousYearCount.toLocaleString())} last year.</p>
      <table><thead><tr><th>Year</th><th>Records</th></tr></thead><tbody>${yearlyRows}</tbody></table>
      <h3 style="margin-top:18px">Seasonality</h3>
      <p>Peak month: ${escapeHtml(data.monitoring.seasonality.peakMonth || 'No peak detected')}.</p>
      <table><thead><tr><th>Month</th><th>Records</th></tr></thead><tbody>${monthlyRows}</tbody></table>
      <h3 style="margin-top:18px">Evidence mix</h3>
      <table><thead><tr><th>Record type</th><th>Count</th></tr></thead><tbody>${evidenceRows}</tbody></table>
      <h3 style="margin-top:18px">Data quality notes</h3>
      <ul>${issueItems}</ul>
      <h3 style="margin-top:18px">Countries observed</h3>
      <ul>${countryItems}</ul>
    </section>

    <section>
      <h2>Ecological Profile</h2>
      <div class="grid">
        <div class="metric"><span>IUCN/GBIF status</span><strong>${escapeHtml(status)}</strong></div>
        <div class="metric"><span>Canonical name</span><strong>${escapeHtml(data.identity.canonicalName)}</strong></div>
        <div class="metric"><span>Ecological sections</span><strong>${escapeHtml(threatGroups.length)}</strong></div>
      </div>
      ${ecologicalSections}
    </section>

    <section>
      <h2>Gallery</h2>
      <p>${escapeHtml(galleryImages.length)} photo${galleryImages.length === 1 ? '' : 's'} from GBIF-linked records.</p>
      <div class="gallery">${galleryMarkup}</div>
    </section>
  </main>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = reportFileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const downloadSpeciesPdfReport = async () => {
    if (generatingPdf) return;
    setGeneratingPdf(true);

    const escapeReportHtml = (value: string | number | null | undefined) =>
      String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    const lastObserved = data.trackerStats.lastObserved
      ? new Date(data.trackerStats.lastObserved).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : 'N/A';
    const status = `${data.conservation.status} - ${data.conservation.statusLabel}`;
    const yearlyRows = data.monitoring.yearlyTrend.yearlyCounts
      .map((item) => `<tr><td>${escapeReportHtml(item.year)}</td><td>${escapeReportHtml(item.count.toLocaleString())}</td></tr>`)
      .join('');
    const evidenceRows = (data.monitoring.recordTypes.length > 0 ? data.monitoring.recordTypes : [{ name: 'Unknown', count: 0 }])
      .map((item) => `<tr><td>${escapeReportHtml(formatFacetName(item.name))}</td><td>${escapeReportHtml(item.count.toLocaleString())}</td></tr>`)
      .join('');
    const countryItems = data.trackerStats.countriesObserved.length
      ? data.trackerStats.countriesObserved.map((country) => `<li>${escapeReportHtml(country)} - ${escapeReportHtml(getCountryName(country))}</li>`).join('')
      : '<li>No country facet data available.</li>';
    const ecologicalSections = threatGroups.length
      ? threatGroups.map(([type, descriptions]) => `
          <article class="note">
            <h3>${escapeReportHtml(formatFacetName(type))}</h3>
            ${descriptions.map((desc) => `<p>${escapeReportHtml(desc)}</p>`).join('')}
          </article>
        `).join('')
      : '<p>No ecological note sections are available for this species.</p>';
    const galleryMarkup = galleryImages.length
      ? galleryImages.slice(0, 12).map((img, index) => `
          <figure>
            <img crossorigin="anonymous" src="${escapeReportHtml(img)}" alt="${escapeReportHtml(commonName)} photo ${index + 1}" />
            <figcaption>Photo ${index + 1}</figcaption>
          </figure>
        `).join('')
      : '<p>No field photos are available for this species.</p>';

    const report = document.createElement('div');
    report.style.position = 'fixed';
    report.style.left = '-12000px';
    report.style.top = '0';
    report.style.width = '1040px';
    report.style.background = '#f7fafc';
    report.innerHTML = `
      <main style="box-sizing:border-box;width:1040px;padding:36px 28px 56px;background:#f7fafc;color:#0f172a;font-family:Inter,Segoe UI,Arial,sans-serif;line-height:1.55;">
        <style>
          .pdf-section { background:#fff;border:1px solid #dbe4ef;border-radius:18px;padding:24px;margin-bottom:18px;box-shadow:0 18px 45px rgba(15,23,42,.06); }
          .pdf-grid { display:grid;grid-template-columns:repeat(4,1fr);gap:12px; }
          .metric { border:1px solid #e2e8f0;border-radius:14px;padding:14px;background:#f8fafc; }
          .metric span { display:block;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.1em; }
          .metric strong { display:block;margin-top:6px;font-size:18px;line-height:1.2; }
          table { width:100%;border-collapse:collapse;margin-top:10px; }
          th,td { border-bottom:1px solid #e2e8f0;padding:8px 6px;text-align:left;font-size:14px; }
          .note { border:1px solid #e2e8f0;border-radius:14px;padding:16px;background:#fbfdff;margin:12px 0; }
          .gallery { display:grid;grid-template-columns:repeat(4,1fr);gap:12px; }
          figure { margin:0;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;background:#fff; }
          figure img { width:100%;aspect-ratio:1/1;object-fit:cover;display:block; }
          figcaption { padding:8px 10px;color:#64748b;font-size:12px; }
        </style>
        <section class="pdf-section">
          <h1 style="margin:0;font-size:34px;line-height:1.15;">${escapeReportHtml(commonName)}</h1>
          <p style="margin:8px 0 0;color:#475569;font-style:italic;">${escapeReportHtml(data.identity.scientificName)}</p>
          <p style="margin:14px 0 0;color:#64748b;font-size:12px;">Generated by EcoTracker. GBIF species key: ${escapeReportHtml(usageKey)}</p>
          <div class="pdf-grid" style="margin-top:18px;">
            <div class="metric"><span>Status</span><strong>${escapeReportHtml(status)}</strong></div>
            <div class="metric"><span>Family</span><strong>${escapeReportHtml(data.identity.family)}</strong></div>
            <div class="metric"><span>Global sightings</span><strong>${escapeReportHtml(data.trackerStats.globalSightings.toLocaleString())}</strong></div>
            <div class="metric"><span>Last spotted</span><strong>${escapeReportHtml(lastObserved)}</strong></div>
          </div>
        </section>
        <section class="pdf-section">
          <h2 style="margin:0 0 14px;font-size:22px;border-bottom:1px solid #e2e8f0;padding-bottom:10px;">Monitoring</h2>
          <div class="pdf-grid">
            <div class="metric"><span>This year</span><strong>${escapeReportHtml(data.trackerStats.sightingsThisYear.toLocaleString())}</strong></div>
            <div class="metric"><span>Countries</span><strong>${escapeReportHtml(data.trackerStats.countriesObserved.length)}</strong></div>
            <div class="metric"><span>Confidence</span><strong>${escapeReportHtml(data.monitoring.dataConfidence.label)}</strong></div>
            <div class="metric"><span>Score</span><strong>${escapeReportHtml(data.monitoring.dataConfidence.score)}</strong></div>
          </div>
          <h3 style="margin:18px 0 8px;font-size:16px;">Observation trend</h3>
          <p>${escapeReportHtml(trendLabel)}. ${escapeReportHtml(data.monitoring.yearlyTrend.currentYearCount.toLocaleString())} records in ${escapeReportHtml(data.monitoring.yearlyTrend.currentYear)}.</p>
          <table><thead><tr><th>Year</th><th>Records</th></tr></thead><tbody>${yearlyRows}</tbody></table>
          <h3 style="margin:18px 0 8px;font-size:16px;">Evidence mix</h3>
          <table><thead><tr><th>Record type</th><th>Count</th></tr></thead><tbody>${evidenceRows}</tbody></table>
          <h3 style="margin:18px 0 8px;font-size:16px;">Countries observed</h3>
          <ul>${countryItems}</ul>
        </section>
        <section class="pdf-section">
          <h2 style="margin:0 0 14px;font-size:22px;border-bottom:1px solid #e2e8f0;padding-bottom:10px;">Ecological Profile</h2>
          ${ecologicalSections}
        </section>
        <section class="pdf-section">
          <h2 style="margin:0 0 14px;font-size:22px;border-bottom:1px solid #e2e8f0;padding-bottom:10px;">Gallery</h2>
          <p>${escapeReportHtml(galleryImages.length)} photo${galleryImages.length === 1 ? '' : 's'} from GBIF-linked records. PDF preview includes up to 12 photos.</p>
          <div class="gallery">${galleryMarkup}</div>
        </section>
      </main>
    `;

    try {
      document.body.appendChild(report);
      await Promise.all(
        Array.from(report.querySelectorAll('img')).map((image) => {
          if (image.complete) return Promise.resolve();
          return new Promise<void>((resolve) => {
            image.onload = () => resolve();
            image.onerror = () => resolve();
          });
        })
      );

      const canvas = await html2canvas(report.querySelector('main') as HTMLElement, {
        backgroundColor: '#f7fafc',
        scale: 2,
        useCORS: true,
        windowWidth: 1040,
      });
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const pageCanvas = document.createElement('canvas');
      const pageContext = pageCanvas.getContext('2d');
      const sourceContext = canvas.getContext('2d');
      if (!pageContext || !sourceContext) {
        throw new Error('Unable to prepare PDF page canvas.');
      }

      const pageHeightPx = Math.floor((pageHeight * canvas.width) / pageWidth);
      pageCanvas.width = canvas.width;
      pageCanvas.height = pageHeightPx;

      const findNaturalPageBreak = (startY: number) => {
        const idealBreak = startY + pageHeightPx;
        if (idealBreak >= canvas.height) return canvas.height;

        const searchRadius = Math.min(Math.floor(pageHeightPx * 0.16), 260);
        const minBreak = Math.max(startY + Math.floor(pageHeightPx * 0.62), idealBreak - searchRadius);
        const maxBreak = Math.min(canvas.height - 1, idealBreak + searchRadius);
        const sampleStepX = Math.max(8, Math.floor(canvas.width / 140));
        let bestY = idealBreak;
        let bestScore = Number.POSITIVE_INFINITY;

        for (let y = minBreak; y <= maxBreak; y += 3) {
          const row = sourceContext.getImageData(0, y, canvas.width, 1).data;
          let inkScore = 0;
          for (let x = 0; x < canvas.width; x += sampleStepX) {
            const index = x * 4;
            const r = row[index];
            const g = row[index + 1];
            const b = row[index + 2];
            const alpha = row[index + 3] / 255;
            const darkness = (255 - (r + g + b) / 3) * alpha;
            if (darkness > 22) inkScore += darkness;
          }

          const distancePenalty = Math.abs(y - idealBreak) * 0.4;
          const score = inkScore + distancePenalty;
          if (score < bestScore) {
            bestScore = score;
            bestY = y;
          }
        }

        return bestY <= startY ? Math.min(startY + pageHeightPx, canvas.height) : bestY;
      };

      let sourceY = 0;
      let pageIndex = 0;
      while (sourceY < canvas.height) {
        const nextBreak = findNaturalPageBreak(sourceY);
        const sliceHeight = Math.min(nextBreak - sourceY, canvas.height - sourceY);
        pageContext.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
        pageContext.fillStyle = '#f7fafc';
        pageContext.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        pageContext.drawImage(
          canvas,
          0,
          sourceY,
          canvas.width,
          sliceHeight,
          0,
          0,
          pageCanvas.width,
          sliceHeight
        );

        if (pageIndex > 0) {
          pdf.addPage();
        }
        pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pageWidth, pageHeight);
        sourceY = nextBreak;
        pageIndex += 1;
      }

      pdf.save(reportFileName.replace(/\.html$/, '.pdf'));
    } catch (pdfError) {
      console.error('Failed to generate species PDF report', pdfError);
      window.alert('PDF export failed. The HTML report is still available.');
    } finally {
      report.remove();
      setGeneratingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <section className="rounded-[2rem] border border-white/8 bg-slate-950/60 backdrop-blur-xl overflow-hidden shadow-[0_20px_60px_-30px_rgba(0,0,0,0.85)]">
        {/* Hero image strip */}
        {data.images[0] && (
          <div className="relative h-48 md:h-56 overflow-hidden">
            <img
              src={data.images[0]}
              alt={commonName}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
            <div className="absolute bottom-4 left-5 flex items-center gap-2">
              <span className={`px-3 py-1.5 rounded-full text-[10px] font-black tracking-[0.24em] uppercase border ${iucnInfo.bg} ${iucnInfo.text} ${iucnInfo.border}`}>
                {data.conservation.status} — {iucnInfo.label}
              </span>
              {data.conservation.isExtinct && (
                <span className="px-3 py-1.5 rounded-full text-[10px] font-black tracking-[0.24em] uppercase border bg-white/5 text-slate-400 border-white/10">
                  Extinct
                </span>
              )}
            </div>
          </div>
        )}

        <div className="p-5 md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              {!data.images[0] && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-3.5 py-1.5 rounded-full text-[10px] font-black tracking-[0.24em] uppercase border ${iucnInfo.bg} ${iucnInfo.text} ${iucnInfo.border}`}>
                    {data.conservation.status} — {iucnInfo.label}
                  </span>
                </div>
              )}
              <div>
                <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">{commonName}</h2>
                <p className="text-slate-400 italic text-lg mt-1">{data.identity.scientificName}</p>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="text-slate-500">Kingdom:</span>
                  <span className="text-slate-200 font-medium">{data.identity.kingdom}</span>
                </span>
                <span className="text-slate-600">·</span>
                <span className="flex items-center gap-1">
                  <span className="text-slate-500">Family:</span>
                  <span className="text-slate-200 font-medium">{data.identity.family}</span>
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={downloadSpeciesReport}
                className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/5 hover:bg-cyan-400/15 text-cyan-300 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.22em] transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l4-4m-4 4l-4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
                </svg>
                Download report
              </button>
              <button
                type="button"
                onClick={downloadSpeciesPdfReport}
                disabled={generatingPdf}
                className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/5 hover:bg-violet-400/15 disabled:opacity-60 disabled:cursor-wait text-violet-200 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.22em] transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 3h7l5 5v13H7a2 2 0 01-2-2V5a2 2 0 012-2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v5h5M8 15h8M8 18h5" />
                </svg>
                {generatingPdf ? 'Building PDF...' : 'PDF export'}
              </button>
              {isSaved ? (
                <button
                  type="button"
                  onClick={() => onRemoveFromWatchlist(usageKey)}
                  disabled={removing}
                  className="inline-flex items-center gap-2 rounded-full border border-red-400/30 bg-red-500/5 hover:bg-red-500/15 text-red-300 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.22em] transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {removing ? 'Removing...' : 'Remove from watchlist'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onAddToWatchlist(watchlistPayload)}
                  disabled={saving}
                  title={isAuthenticated ? 'Add this species to your watchlist' : 'Sign in to save species'}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-400/35 bg-emerald-500/5 hover:bg-emerald-400/15 text-emerald-300 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.22em] transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                  {saving ? 'Saving...' : 'Add to watchlist'}
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white w-10 h-10 transition-all"
                aria-label="Close tracker"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Global Sightings',
            value: data.trackerStats.globalSightings.toLocaleString(),
            sub: 'Total observation records',
            color: 'text-white',
            icon: (
              <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            ),
          },
          {
            label: 'This Year',
            value: `+${data.trackerStats.sightingsThisYear.toLocaleString()}`,
            sub: 'Recent sightings',
            color: 'text-emerald-300',
            icon: (
              <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            ),
          },
          {
            label: 'Countries',
            value: data.trackerStats.countriesObserved.length.toString(),
            sub: 'Tracked worldwide',
            color: 'text-cyan-300',
            icon: (
              <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
              </svg>
            ),
          },
          {
            label: 'Last Spotted',
            value: data.trackerStats.lastObserved
              ? new Date(data.trackerStats.lastObserved).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : 'N/A',
            sub: 'Latest observation',
            color: 'text-amber-300',
            icon: (
              <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ),
          },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-white/8 bg-slate-950/55 backdrop-blur-xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500 font-semibold">{stat.label}</p>
              {stat.icon}
            </div>
            <div className={`text-2xl font-black leading-none ${stat.color}`}>{stat.value}</div>
            <p className="text-slate-500 text-[10px] uppercase tracking-[0.18em]">{stat.sub}</p>
          </div>
        ))}
      </div>

      {data.trackerStats.countriesObserved.length > 0 && (
        <div className="rounded-2xl border border-white/8 bg-slate-950/45 backdrop-blur-xl p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500 font-semibold">Countries observed</p>
              <p className="mt-1 text-xs text-slate-400">Hover a country code to see its full name.</p>
            </div>
            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-black text-cyan-200">
              {data.trackerStats.countriesObserved.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {displayedCountries.map((country) => (
              <span
                key={country}
                title={getCountryName(country)}
                className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/8 text-slate-300 text-[10px] font-semibold uppercase tracking-[0.16em]"
              >
                {country}
              </span>
            ))}
            {data.trackerStats.countriesObserved.length > 12 && (
              <button type="button" onClick={() => setShowAllCountries(!showAllCountries)} className="px-2.5 py-1 rounded-lg text-[10px] text-cyan-300 hover:text-cyan-200 font-semibold">
                {showAllCountries ? 'Show less' : `+${data.trackerStats.countriesObserved.length - 12} more`}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-white/8 bg-slate-950/45 backdrop-blur-xl p-1.5 flex flex-wrap gap-1.5">
        {[
          { id: 'monitoring', label: 'Monitoring' },
          { id: 'ecology', label: 'Ecological Profile' },
          { id: 'gallery', label: `Gallery (${galleryImages.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as 'monitoring' | 'ecology' | 'gallery')}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === tab.id
                ? 'bg-emerald-400/12 text-emerald-200 shadow-[0_0_0_1px_rgba(52,211,153,0.18)]'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'monitoring' && (
        <section className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-white/8 bg-slate-950/55 backdrop-blur-xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500 font-semibold">Observation Trend</p>
                  <h3 className={`mt-2 text-lg font-black ${trendTone}`}>{trendLabel}</h3>
                </div>
                <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] border ${
                  data.monitoring.yearlyTrend.direction === 'up'
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                    : data.monitoring.yearlyTrend.direction === 'down'
                      ? 'bg-red-500/10 text-red-300 border-red-500/20'
                      : 'bg-white/5 text-slate-300 border-white/10'
                }`}>
                  {data.monitoring.yearlyTrend.changePercent > 0 ? '+' : ''}{data.monitoring.yearlyTrend.changePercent}%
                </span>
              </div>
              <div className="mt-5 flex items-end gap-2 h-24">
                {data.monitoring.yearlyTrend.yearlyCounts.map((item) => (
                  <div key={item.year} className="flex-1 flex flex-col items-center gap-2 min-w-0">
                    <div className="w-full rounded-t-lg bg-emerald-400/70 min-h-[4px]" style={{ height: `${Math.max(4, (item.count / maxYearlyCount) * 84)}px` }} />
                    <span className="text-[9px] text-slate-500 font-semibold">{String(item.year).slice(2)}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-slate-400">
                {data.monitoring.yearlyTrend.currentYearCount.toLocaleString()} records in {data.monitoring.yearlyTrend.currentYear}, compared with {data.monitoring.yearlyTrend.previousYearCount.toLocaleString()} last year.
              </p>
            </div>

            <div className="rounded-2xl border border-white/8 bg-slate-950/55 backdrop-blur-xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500 font-semibold">Data Confidence</p>
                  <h3 className="mt-2 text-lg font-black text-cyan-300">{data.monitoring.dataConfidence.label}</h3>
                </div>
                <div className="h-12 w-12 rounded-full border border-cyan-400/30 bg-cyan-500/10 flex items-center justify-center text-cyan-200 text-base font-black">
                  {data.monitoring.dataConfidence.score}
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {[
                  { label: 'Mapped records', value: data.monitoring.dataConfidence.coordinateCoverage },
                  { label: 'Photo evidence', value: data.monitoring.dataConfidence.photoCoverage },
                  { label: 'GBIF issue rate', value: data.monitoring.dataConfidence.issueRate, inverse: true },
                ].map((metric) => (
                  <div key={metric.label}>
                    <div className="flex justify-between text-[10px] uppercase tracking-[0.18em] text-slate-500 font-semibold mb-1.5">
                      <span>{metric.label}</span>
                      <span>{metric.value}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${metric.inverse ? 'bg-amber-400/80' : 'bg-cyan-400/80'}`}
                        style={{ width: `${Math.min(100, Math.max(0, metric.value))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/8 bg-slate-950/55 backdrop-blur-xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500 font-semibold">Seasonal Watch</p>
                  <h3 className="mt-2 text-lg font-black text-amber-300">
                    {data.monitoring.seasonality.peakMonth || 'No peak detected'}
                  </h3>
                </div>
                <span className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] border bg-amber-500/10 text-amber-300 border-amber-500/20">
                  Peak
                </span>
              </div>
              <div className="mt-5 grid grid-cols-12 gap-1.5 h-24 items-end">
                {data.monitoring.seasonality.monthlyCounts.map((item) => (
                  <div key={item.month} className="flex flex-col items-center gap-2 min-w-0">
                    <div className="w-full rounded-t bg-amber-400/70 min-h-[4px]" style={{ height: `${Math.max(4, (item.count / maxMonthlyCount) * 80)}px` }} />
                    <span className="text-[8px] text-slate-500">{item.label[0]}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-slate-400">
                Use peak months to prioritize patrols, camera checks, or citizen-science campaigns.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/8 bg-slate-950/55 backdrop-blur-xl p-4">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500 font-semibold">Map country filter</p>
                <p className="mt-1 text-xs text-slate-400">Click country codes to filter sightings and range layer below.</p>
              </div>
              {selectedMapCountries.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedMapCountries([])}
                  className="w-fit rounded-full border border-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-300 hover:border-emerald-400/25 hover:text-emerald-200"
                >
                  Clear filter
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {data.trackerStats.countriesObserved.map((country) => {
                const code = country.toUpperCase();
                const active = selectedMapCountries.includes(code);
                return (
                  <button
                    key={country}
                    type="button"
                    title={getCountryName(country)}
                    aria-pressed={active}
                    onClick={() => toggleMapCountry(country)}
                    className={`px-2.5 py-1 rounded-lg border text-[10px] font-semibold uppercase tracking-[0.16em] transition-colors ${
                      active
                        ? 'border-emerald-400/30 bg-emerald-400/15 text-emerald-200'
                        : 'border-white/8 bg-white/5 text-slate-300 hover:border-cyan-400/25 hover:text-cyan-200'
                    }`}
                  >
                    {country}
                  </button>
                );
              })}
            </div>
          </div>

          <SpeciesMap
            taxonKey={usageKey}
            scientificName={data.identity.scientificName}
            heightClass="h-[460px] md:h-[520px]"
            selectedCountryCodes={selectedMapCountries}
          />

          <div className="rounded-2xl border border-white/8 bg-slate-950/55 backdrop-blur-xl p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500 font-semibold">Evidence Mix</p>
                <h3 className="text-base font-semibold text-white mt-1">GBIF record types behind this tracker</h3>
              </div>
              <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Occurrence basis</span>
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(data.monitoring.recordTypes.length > 0 ? data.monitoring.recordTypes : [{ name: 'Unknown', count: 0 }]).map((item) => (
                <div key={item.name} className="rounded-xl border border-white/8 bg-white/3 px-4 py-3 flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-300 font-semibold">{formatFacetName(item.name)}</span>
                  <span className="text-sm text-emerald-300 font-black">{item.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {activeTab === 'ecology' && (
        <section className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-white/8 bg-slate-950/55 backdrop-blur-xl p-5">
              <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500 font-semibold">Conservation</p>
              <h3 className={`mt-3 text-2xl font-black ${iucnInfo.text}`}>{data.conservation.status}</h3>
              <p className="text-sm text-slate-300 mt-1">{data.conservation.statusLabel}</p>
              <p className="text-xs text-slate-500 mt-4">{isCritical ? 'High-priority monitoring species based on conservation status.' : 'Monitor occurrence quality, range, and observation recency.'}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-slate-950/55 backdrop-blur-xl p-5">
              <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500 font-semibold">Taxonomy</p>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-3"><span className="text-slate-500">Kingdom</span><span className="text-slate-200 font-semibold">{data.identity.kingdom}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Family</span><span className="text-slate-200 font-semibold">{data.identity.family}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Canonical</span><span className="text-slate-200 font-semibold text-right">{data.identity.canonicalName}</span></div>
              </div>
            </div>
            <div className="rounded-2xl border border-white/8 bg-slate-950/55 backdrop-blur-xl p-5">
              <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500 font-semibold">External Resources</p>
              <div className="mt-4 space-y-2">
                <a href={`https://www.gbif.org/species/${usageKey}`} target="_blank" rel="noopener noreferrer" className="block rounded-xl border border-white/8 bg-white/4 px-3 py-2.5 text-xs font-semibold text-cyan-300 hover:bg-white/8">View on GBIF.org</a>
                <a href={`https://www.iucnredlist.org/search?query=${encodeURIComponent(data.identity.scientificName)}`} target="_blank" rel="noopener noreferrer" className="block rounded-xl border border-white/8 bg-white/4 px-3 py-2.5 text-xs font-semibold text-amber-300 hover:bg-white/8">Search IUCN Red List</a>
              </div>
            </div>
          </div>

          {threatGroups.length > 0 && (
            <EcologicalInsightPanel
              commonName={commonName}
              scientificName={data.identity.scientificName}
              conservationStatus={`${data.conservation.status} ${data.conservation.statusLabel}`}
              sections={threatGroups.map(([type, descriptions]) => ({
                label: formatFacetName(type),
                text: descriptions.join('\n\n'),
              }))}
            />
          )}

          <div className="rounded-2xl border border-white/8 bg-slate-950/55 backdrop-blur-xl p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-5">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500 font-semibold">Ecological Notes</p>
                <h3 className="text-lg font-semibold text-white mt-1">GBIF description sections and conservation notes</h3>
              </div>
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border ${
                isCritical ? 'bg-red-500/15 text-red-300 border-red-500/20' : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20'
              }`}>
                {threatGroups.length || 0} sections
              </span>
            </div>

            {threatGroups.length > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {threatGroups.map(([type, descriptions]) => {
                    const colorClass = threatTypeColors[type] || 'text-slate-300 bg-white/5 border-white/10';
                    return (
                      <div key={type} className="rounded-2xl border border-white/8 bg-white/3 p-4 flex flex-col">
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] uppercase tracking-[0.2em] font-black border w-fit mb-3 ${colorClass}`}>
                          {type.replace(/_/g, ' ')}
                        </div>
                        <div className="space-y-2 overflow-y-auto max-h-56 custom-scrollbar flex-1 pr-1">
                          {descriptions.map((desc, index) => (
                            <p key={index} className="text-sm text-slate-300 leading-relaxed">{desc}</p>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
                GBIF has no ecological note sections for this species yet.
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === 'gallery' && (
        <section className="space-y-4">
          <div className="rounded-2xl border border-white/8 bg-slate-950/55 backdrop-blur-xl p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500 font-semibold">Field Evidence Gallery</p>
                <h3 className="text-lg font-semibold text-white mt-1">{galleryImages.length} photos from GBIF-linked records</h3>
              </div>
            </div>
            {galleryImages.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {galleryImages.map((img, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setSelectedImage(img)}
                    className="aspect-square rounded-2xl overflow-hidden border border-white/8 hover:border-emerald-500/40 transition-all duration-300 group relative cursor-zoom-in bg-white/5"
                  >
                    <img src={img} alt={`${commonName} ${index + 1}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" loading="lazy" />
                    <div className="absolute inset-0 bg-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
                No additional field photos are available for this species.
              </div>
            )}
          </div>
        </section>
      )}

      {/* Lightbox */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-[9999] bg-slate-950/97 backdrop-blur-2xl flex items-center justify-center p-4 md:p-12"
          onClick={() => setSelectedImage(null)}
        >
          <button
            className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-red-500/20 text-white/70 hover:text-red-200 transition-all"
            onClick={() => setSelectedImage(null)}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="relative max-w-5xl w-full max-h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <img
              src={selectedImage}
              alt="Enlarged view"
              className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl border border-white/10"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default SpeciesTracker;
