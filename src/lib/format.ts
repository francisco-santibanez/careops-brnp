/**
 * Deterministic date and time formatting to avoid SSR / Client hydration mismatches
 * Clinical home care standard uses 24-hour timestamping (HH:mm or HH:mm:ss).
 */
export function formatTime(
  input: Date | string | number | null | undefined,
  includeSeconds = false
): string {
  if (!input) return '';
  const date = typeof input === 'string' || typeof input === 'number' ? new Date(input) : input;
  if (isNaN(date.getTime())) return '';

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  if (includeSeconds) {
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }

  return `${hours}:${minutes}`;
}
