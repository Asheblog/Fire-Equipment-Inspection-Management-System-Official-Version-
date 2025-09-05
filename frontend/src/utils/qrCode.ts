// Utility to extract a short QR code identifier from a possibly full URL/path
// Rules:
// 1. If starts with http/https, strip protocol+host, keep pathname
// 2. If contains marker '/m/inspection/' take substring after it
// 3. Remove leading slashes
// 4. Strip query/hash
// 5. Return trimmed result (fallback to original if empty)

const MARKER = '/m/inspection/';

export function extractQrCode(raw: string | undefined | null): string {
  if (!raw) return '';
  let work = raw.trim();
  try {
    if (/^https?:\/\//i.test(work)) {
      const u = new URL(work);
      work = u.pathname + (u.search || '');
    }
  } catch {
    // ignore malformed URL
  }
  const idx = work.indexOf(MARKER);
  if (idx >= 0) {
    work = work.substring(idx + MARKER.length);
  }
  work = work.replace(/^\/+/, '');
  work = work.split('#')[0].split('?')[0];
  return work || raw;
}

// Optionally format for UI (monospace etc.) - currently just alias
export function formatQrCodeDisplay(raw: string | undefined | null): string {
  return extractQrCode(raw);
}

