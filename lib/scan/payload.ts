const QR_PREFIX = "BCL-";

/**
 * Parses a bib QR payload (`BCL-{athleteNo}`, §4.1) into an athlete number.
 * The prefix exists precisely so the scanner can reject foreign QR codes
 * (someone's boarding pass, a poster in the venue) instead of mis-scanning
 * garbage into a capture.
 */
export function parseBibPayload(data: string): number | null {
  if (!data.startsWith(QR_PREFIX)) return null;
  const digits = data.slice(QR_PREFIX.length);
  if (!/^\d+$/.test(digits)) return null;
  return Number(digits);
}
