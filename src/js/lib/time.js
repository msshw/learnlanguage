// Pure: no DOM, no network, no clock. `now` is always passed in.
// A day runs from 04:00 to 04:00 in the given timezone, so late-night sessions
// count toward the same day.

const ROLLOVER_HOUR = 4;

function localParts(date, tz) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

// Local wall clock minus UTC, in ms, at the given instant.
function offsetMs(date, tz) {
  const p = localParts(date, tz);
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wallAsUtc - Math.floor(date.getTime() / 1000) * 1000;
}

// The instant at which the local clock reads 04:00 on the given calendar date.
// The offset is read twice because it can differ between the guess and the result (DST).
function rolloverInstant(year, month, day, tz) {
  const wall = Date.UTC(year, month - 1, day, ROLLOVER_HOUR);
  const first = wall - offsetMs(new Date(wall), tz);
  return new Date(wall - offsetMs(new Date(first), tz));
}

function startOfLogicalDay(now, tz, dayShift) {
  const p = localParts(now, tz);
  const shift = (p.hour < ROLLOVER_HOUR ? -1 : 0) + dayShift;
  const date = new Date(Date.UTC(p.year, p.month - 1, p.day + shift));
  return rolloverInstant(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), tz);
}

export const dayStart = (now, tz) => startOfLogicalDay(now, tz, 0);
export const nextDayStart = (now, tz) => startOfLogicalDay(now, tz, 1);

// The calendar date (YYYY-MM-DD) on the local clock. Not the logical day: no 04:00 rollover.
export function localDate(now, tz) {
  const p = localParts(now, tz);
  const pad = (n) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}
