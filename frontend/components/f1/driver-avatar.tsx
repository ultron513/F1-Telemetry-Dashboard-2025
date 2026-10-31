"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { liveryGradient, teamTheme } from "@/lib/teams";
import { cn } from "@/lib/utils";

/**
 * Driver portrait slot.
 *
 * Photos are opt-in: drop an image you are licensed to use into
 * `public/drivers/` and list it in `public/drivers/manifest.json`
 * (e.g. { "VER": "VER.webp" }). Drivers without a photo get a generated
 * card in their team's colours with their race number and a generic helmet.
 */

type Manifest = Record<string, string>;

function useManifest() {
  return useQuery({
    queryKey: ["driver-photo-manifest"],
    queryFn: async (): Promise<Manifest> => {
      try {
        const res = await fetch("/drivers/manifest.json", { cache: "force-cache" });
        if (!res.ok) return {};
        const json = await res.json();
        return Object.fromEntries(Object.entries(json).filter(([k]) => !k.startsWith("_"))) as Manifest;
      } catch {
        return {};
      }
    },
    staleTime: Infinity,
  });
}

interface Props {
  code: string;
  number?: string | null;
  team: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  /** Hide the number on the generated card (tiny sizes). */
  plain?: boolean;
}

const SIZES = {
  xs: "size-6 rounded-full",
  sm: "size-8 rounded-full",
  md: "size-14 rounded-lg",
  lg: "h-40 w-32 rounded-lg",
  xl: "h-56 w-44 rounded-xl",
};

export function DriverAvatar({ code, number, team, size = "sm", className, plain }: Props) {
  const manifest = useManifest();
  const [failed, setFailed] = useState(false);
  const file = manifest.data?.[code];
  const theme = teamTheme(team);

  if (file && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/drivers/${file}`}
        alt=""
        onError={() => setFailed(true)}
        className={cn("shrink-0 object-cover object-top", SIZES[size], className)}
        style={{ background: liveryGradient(theme) }}
      />
    );
  }

  const tiny = size === "xs" || size === "sm";
  return (
    <span
      aria-hidden
      className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden", SIZES[size], className)}
      style={{ background: tiny ? theme.primary : liveryGradient(theme) }}
    >
      {tiny ? (
        <span className="text-[11px] font-bold italic" style={{ color: theme.onPrimary }}>
          {plain ? code.slice(0, 1) : (number ?? code.slice(0, 2))}
        </span>
      ) : (
        <>
          <span
            className="absolute -right-1 -bottom-3 leading-none font-bold italic opacity-90 select-none"
            style={{
              color: luminance(theme.secondary) < 0.2 ? theme.primary : theme.secondary,
              fontSize: size === "md" ? 34 : size === "lg" ? 96 : 132,
              WebkitTextStroke: `1px ${theme.deep}`,
            }}
          >
            {number}
          </span>
          <Helmet
            primary={theme.primary}
            secondary={theme.secondary}
            deep={theme.deep}
            className={cn("absolute", size === "md" ? "top-1.5 left-1 w-9" : "top-4 left-2 w-[70%]")}
          />
          {size !== "md" && (
            <span className="absolute top-2 left-2.5 text-sm font-bold tracking-wide" style={{ color: luminance(theme.secondary) < 0.2 ? theme.primary : theme.secondary }}>
              {code}
            </span>
          )}
        </>
      )}
    </span>
  );
}

/** Generic, unbranded helmet silhouette. */
function Helmet({ primary, secondary, deep, className }: { primary: string; secondary: string; deep: string; className?: string }) {
  return (
    <svg viewBox="0 0 120 100" className={className} aria-hidden>
      <path
        d="M14 64C10 34 34 10 66 10c28 0 48 18 50 44l1 14c0 6-4 10-10 10H76l-8 10H30c-9 0-15-6-16-14z"
        fill={primary}
        stroke={deep}
        strokeWidth="2"
      />
      <path d="M58 40h52c3 0 5 2 5 5v9c0 3-2 5-5 5H62c-6 0-10-4-10-10 0-5 2-9 6-9z" fill={deep} />
      <path d="M60 44h46" stroke={secondary} strokeWidth="2" opacity="0.55" />
      <path d="M18 70c10 4 26 6 42 4" stroke={secondary} strokeWidth="5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
