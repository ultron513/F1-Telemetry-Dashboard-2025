// Export any chart (SVG or WebGL canvas) as a branded PNG card for social media.

const STYLE_PROPS = [
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "stroke-dasharray",
  "stroke-linecap",
  "stroke-linejoin",
  "opacity",
  "font-family",
  "font-size",
  "font-weight",
  "letter-spacing",
  "text-anchor",
  "dominant-baseline",
  "visibility",
  "display",
] as const;

function cssVar(name: string, fallback: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/** Copy resolved styles inline, so CSS variables and classes survive serialisation. */
function inlineStyles(source: SVGElement, target: SVGElement) {
  const src = [source, ...Array.from(source.querySelectorAll("*"))] as Element[];
  const dst = [target, ...Array.from(target.querySelectorAll("*"))] as Element[];
  src.forEach((el, i) => {
    const out = dst[i] as SVGElement | undefined;
    if (!out) return;
    const cs = getComputedStyle(el);
    const decl = STYLE_PROPS.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(";");
    out.setAttribute("style", decl);
  });
}

async function svgToImage(svg: SVGSVGElement): Promise<{ img: HTMLImageElement; w: number; h: number }> {
  const rect = svg.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  const clone = svg.cloneNode(true) as SVGSVGElement;
  inlineStyles(svg, clone);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));
  if (!clone.getAttribute("viewBox")) clone.setAttribute("viewBox", `0 0 ${w} ${h}`);
  const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "sync";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not render the chart."));
      img.src = url;
    });
    return { img, w, h };
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export interface ShareMeta {
  title: string;
  subtitle?: string;
  filename?: string;
}

/** Render the chart inside ``container`` onto a branded card and return a PNG blob. */
export async function renderCard(container: HTMLElement, meta: ShareMeta): Promise<Blob> {
  const svgs = Array.from(container.querySelectorAll("svg")).filter((s) => s.getBoundingClientRect().width > 120);
  const canvas3d = container.querySelector("canvas");
  let source: { img: CanvasImageSource; w: number; h: number };
  if (canvas3d && canvas3d.width > 0) {
    const r = canvas3d.getBoundingClientRect();
    source = { img: canvas3d, w: r.width, h: r.height };
  } else if (svgs.length) {
    const biggest = svgs.reduce((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return rb.width * rb.height > ra.width * ra.height ? b : a;
    });
    source = await svgToImage(biggest);
  } else {
    throw new Error("Nothing to export in this panel.");
  }

  const scale = 2;
  const pad = 36;
  const header = 84;
  const footer = 44;
  const W = Math.max(720, source.w + pad * 2);
  const H = header + source.h + footer + pad;
  const out = document.createElement("canvas");
  out.width = W * scale;
  out.height = H * scale;
  const ctx = out.getContext("2d")!;
  ctx.scale(scale, scale);

  const bg = cssVar("--surface", "#11141a");
  const ink = cssVar("--ink", "#f4f5f7");
  const ink3 = cssVar("--ink-3", "#8a92a0");
  const team = cssVar("--team-primary", "#e10600");
  const font = cssVar("--font-sans", "system-ui, sans-serif");

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = team;
  ctx.fillRect(0, 0, W, 5);

  ctx.fillStyle = ink;
  ctx.font = `700 24px ${font}`;
  ctx.textBaseline = "top";
  ctx.fillText(meta.title, pad, 26);
  if (meta.subtitle) {
    ctx.fillStyle = ink3;
    ctx.font = `400 14px ${font}`;
    ctx.fillText(meta.subtitle, pad, 58);
  }
  ctx.drawImage(source.img, (W - source.w) / 2, header, source.w, source.h);

  ctx.fillStyle = ink3;
  ctx.font = `400 12px ${font}`;
  ctx.textBaseline = "bottom";
  ctx.fillText("Data: FastF1 / F1 live timing. Unofficial, not associated with Formula 1.", pad, H - 18);
  ctx.fillStyle = team;
  ctx.font = `800 15px ${font}`;
  ctx.textAlign = "right";
  ctx.fillText("PIT WALL", W - pad, H - 16);

  return await new Promise<Blob>((resolve, reject) =>
    out.toBlob((b) => (b ? resolve(b) : reject(new Error("Export failed."))), "image/png"),
  );
}

/** Share through the OS share sheet when available, otherwise download. */
export async function shareCard(container: HTMLElement, meta: ShareMeta): Promise<"shared" | "downloaded"> {
  const blob = await renderCard(container, meta);
  const name = `${(meta.filename ?? meta.title).replace(/[^\w-]+/g, "-").toLowerCase()}.png`;
  const file = new File([blob], name, { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] }) && window.matchMedia("(pointer: coarse)").matches) {
    try {
      await navigator.share({ files: [file], title: meta.title, text: meta.subtitle });
      return "shared";
    } catch {
      /* cancelled: fall through to download */
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return "downloaded";
}
