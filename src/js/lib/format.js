import { dayStart } from './time.js';

// "Tue 13 Oct" for the start of a day, "Tue 13 Oct, 14:00" for any other moment.
export function formatNextDue(date, tz, locale) {
  const day = new Intl.DateTimeFormat(locale, { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short' });
  const time = new Intl.DateTimeFormat(locale, { timeZone: tz, hour: '2-digit', minute: '2-digit' });
  if (dayStart(date, tz).getTime() === date.getTime()) return day.format(date);
  return `${day.format(date)}, ${time.format(date)}`;
}

// Short relative interval from `now` to `due`: "10 min", "1 hour", "3 days", "2 months", "1 year".
export function formatInterval(due, now) {
  const minutes = Math.max(1, Math.round((due - now) / 60000));
  const plural = (n, unit) => `${n} ${unit}${n === 1 ? '' : 's'}`;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return plural(hours, 'hour');
  const days = Math.round(hours / 24);
  if (days < 30) return plural(days, 'day');
  if (days < 365) return plural(Math.round(days / 30), 'month');
  return plural(Math.round(days / 365), 'year');
}

// Today's logical date (04:00 rollover) on the profile clock: "Sunday 11 October".
export function formatDay(now, tz, locale) {
  const day = new Intl.DateTimeFormat(locale, { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' });
  return day.format(dayStart(now, tz));
}

// Due date in logical days from today: "Today" (also when overdue), "Tomorrow", "In 4 days".
export function formatRelativeDay(due, now, tz) {
  const days = Math.round((dayStart(due, tz) - dayStart(now, tz)) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

// "Good morning" 05:00 to 12:00, "Good afternoon" to 18:00, "Good evening" otherwise, on the profile clock.
export function greeting(now, tz, name) {
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(now));
  const part = hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 18 ? 'afternoon' : 'evening';
  const trimmed = name?.trim();
  return trimmed ? `Good ${part}, ${trimmed}` : `Good ${part}`;
}
