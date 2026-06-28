export function isKitchenOpen(openingTime?: string | null, closingTime?: string | null): boolean {
  if (!openingTime || !closingTime) return true;
  const now = new Date();
  const [openH, openM] = openingTime.split(':').map(Number);
  const [closeH, closeM] = closingTime.split(':').map(Number);
  const openMins = openH * 60 + openM;
  const closeMins = closeH * 60 + closeM;
  const nowMins = now.getHours() * 60 + now.getMinutes();
  // crosses midnight (e.g. 10:00 → 01:00 next day)
  if (closeMins < openMins) return nowMins >= openMins || nowMins <= closeMins;
  return nowMins >= openMins && nowMins <= closeMins;
}

export function minutesUntilOpen(openingTime?: string | null): number {
  if (!openingTime) return 0;
  const now = new Date();
  const [openH, openM] = openingTime.split(':').map(Number);
  const openMins = openH * 60 + openM;
  const nowMins = now.getHours() * 60 + now.getMinutes();
  if (openMins > nowMins) return openMins - nowMins;
  return (24 * 60 - nowMins) + openMins;
}

export function formatTime12h(timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${displayH}:${m === 0 ? '00' : String(m).padStart(2, '0')} ${period}`;
}
