const relative = new Intl.RelativeTimeFormat('en-IN', { numeric: 'auto' });
const date = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  timeZone: 'Asia/Kolkata',
});

/** "just now", "5 minutes ago", "yesterday", "3 Nov". */
export function ago(iso: string, now = Date.now()): string {
  const seconds = Math.round((Date.parse(iso) - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return 'just now';
  if (abs < 60 * 60) return relative.format(Math.round(seconds / 60), 'minute');
  if (abs < 60 * 60 * 24) return relative.format(Math.round(seconds / 3600), 'hour');
  if (abs < 60 * 60 * 24 * 7) return relative.format(Math.round(seconds / 86_400), 'day');
  return date.format(new Date(iso));
}
