import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

/** Index of the last element <= target in a sorted array (binary search). */
export function bisect(arr: ArrayLike<number>, target: number): number {
  let lo = 0;
  let hi = arr.length - 1;
  if (hi < 0) return -1;
  if (target <= arr[0]) return 0;
  if (target >= arr[hi]) return hi;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] <= target) lo = mid;
    else hi = mid;
  }
  return lo;
}

export function downloadBlob(content: BlobPart, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function toCsv(columns: Record<string, ArrayLike<number | string | null>>): string {
  const keys = Object.keys(columns);
  const n = Math.max(...keys.map((k) => columns[k].length));
  const rows = [keys.join(",")];
  for (let i = 0; i < n; i++) rows.push(keys.map((k) => columns[k][i] ?? "").join(","));
  return rows.join("\n");
}

/** Rasterise an inline <svg> element to PNG and download it. */
export async function downloadSvgAsPng(svg: SVGSVGElement, filename: string, background: string) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const { width, height } = svg.getBoundingClientRect();
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  // Inline computed colours of CSS variables so the export is self-contained.
  const style = getComputedStyle(document.documentElement);
  const vars = ["--team-primary", "--team-secondary", "--team-tertiary", "--teammate", "--ink", "--ink-2", "--ink-3", "--line", "--line-strong", "--surface-2", "--surface-3", "--chart-grid", "--chart-axis", "--surface", "--bg"];
  const css = vars.map((v) => `${v}:${style.getPropertyValue(v)}`).join(";");
  clone.setAttribute("style", `${css};font-family:${style.getPropertyValue("font-family")}`);
  const xml = new XMLSerializer().serializeToString(clone);
  const img = new Image();
  const scale = 2;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  });
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  canvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, filename, "image/png");
  }, "image/png");
}
