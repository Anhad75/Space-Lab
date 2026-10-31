// Display formatting helpers. All times are UTC.

const pad = (n) => String(n).padStart(2, "0");

export function fmtUTC(ms, withTime = true) {
  if (ms == null) return "—";
  const d = new Date(ms);
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  return withTime ? `${date} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` : date;
}

/** Hours -> "3 d 4 h" / "5 h 20 m". */
export function fmtDuration(hours) {
  if (hours == null || !isFinite(hours)) return "—";
  if (hours >= 48) {
    const d = Math.floor(hours / 24);
    return `${d} d ${Math.round(hours - d * 24)} h`;
  }
  if (hours >= 1) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m ? `${h} h ${m} m` : `${h} h`;
  }
  return `${Math.round(hours * 60)} m`;
}

export const fmtDeg = (d, digits = 2) => (d == null || !isFinite(d) ? "—" : `${d.toFixed(digits)}°`);
export const fmtPct = (p) => (p == null || !isFinite(p) ? "—" : `${Math.round(p)}%`);

export function fmtLatLon(lat, lon) {
  const ns = lat < 0 ? "S" : "N";
  const e = ((lon % 360) + 360) % 360;
  return `${Math.abs(lat).toFixed(3)}°${ns}, ${e.toFixed(3)}°E`;
}

/** "YYYY-MM-DDTHH:MM" for <input type="datetime-local"> treated as UTC. */
export function toInputValue(ms) {
  return fmtUTC(ms).replace(" ", "T");
}
export function fromInputValue(v) {
  const ms = Date.parse(`${v}:00Z`);
  return Number.isNaN(ms) ? null : ms;
}
