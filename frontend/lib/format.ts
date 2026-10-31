export type SpeedUnit = "kmh" | "mph";
export type TempUnit = "c" | "f";

export function lapTime(seconds: number | null | undefined, digits = 3): string {
  if (seconds == null || !isFinite(seconds)) return "—";
  const sign = seconds < 0 ? "-" : "";
  const s = Math.abs(seconds);
  const minutes = Math.floor(s / 60);
  const rest = s - minutes * 60;
  if (minutes === 0) return `${sign}${rest.toFixed(digits)}`;
  return `${sign}${minutes}:${rest.toFixed(digits).padStart(digits + 3, "0")}`;
}

export function sectorTime(seconds: number | null | undefined): string {
  if (seconds == null || !isFinite(seconds)) return "—";
  return seconds.toFixed(3);
}

export function delta(seconds: number | null | undefined, digits = 3): string {
  if (seconds == null || !isFinite(seconds)) return "—";
  const sign = seconds > 0 ? "+" : seconds < 0 ? "−" : "±";
  return `${sign}${Math.abs(seconds).toFixed(digits)}`;
}

export function speed(kmh: number | null | undefined, unit: SpeedUnit, digits = 0): string {
  if (kmh == null || !isFinite(kmh)) return "—";
  const v = unit === "mph" ? kmh * 0.621371 : kmh;
  return v.toFixed(digits);
}

export function speedUnitLabel(unit: SpeedUnit) {
  return unit === "mph" ? "mph" : "km/h";
}

export function temp(c: number | null | undefined, unit: TempUnit, digits = 1): string {
  if (c == null || !isFinite(c)) return "—";
  const v = unit === "f" ? c * 1.8 + 32 : c;
  return v.toFixed(digits);
}

export function tempUnitLabel(unit: TempUnit) {
  return unit === "f" ? "°F" : "°C";
}

export function pct(v: number | null | undefined, digits = 0): string {
  if (v == null || !isFinite(v)) return "—";
  return `${v.toFixed(digits)}%`;
}

export function num(v: number | null | undefined, digits = 0): string {
  if (v == null || !isFinite(v)) return "—";
  return v.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function clock(seconds: number | null | undefined): string {
  if (seconds == null || !isFinite(seconds)) return "—";
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function ordinal(n: number | null | undefined): string {
  if (n == null) return "—";
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function countryFlagEmoji(country: string): string {
  // Small table for the calendar; falls back to nothing.
  const map: Record<string, string> = {
    Australia: "AU", China: "CN", Japan: "JP", Bahrain: "BH", "Saudi Arabia": "SA",
    "United States": "US", USA: "US", Italy: "IT", Monaco: "MC", Spain: "ES", Canada: "CA",
    Austria: "AT", "United Kingdom": "GB", UK: "GB", Belgium: "BE", Hungary: "HU",
    Netherlands: "NL", Azerbaijan: "AZ", Singapore: "SG", Mexico: "MX", Brazil: "BR",
    Qatar: "QA", "Abu Dhabi": "AE", "United Arab Emirates": "AE", "Las Vegas": "US",
    Miami: "US", France: "FR", Portugal: "PT", Germany: "DE", Russia: "RU", Turkey: "TR",
  };
  const code = map[country];
  if (!code) return "";
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
