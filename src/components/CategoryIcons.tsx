// Category icons as inline SVGs — professional, scalable, no external deps
// Each icon is designed to be recognizable at 32x32 to 48x48px

import React from "react";

export const categoryIcons: Record<string, { svg: React.ReactNode; color: string }> = {
  hvac: {
    color: "#dc2626", // red for heating
    svg: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        {/* Thermostat with temperature lines */}
        <rect x="18" y="4" width="12" height="32" rx="6" stroke="currentColor" strokeWidth="2.5" fill="none" />
        <circle cx="24" cy="33" r="5" fill="currentColor" />
        <rect x="22" y="10" width="4" height="20" rx="2" fill="currentColor" opacity="0.6" />
        {/* Temperature lines on sides */}
        <line x1="6" y1="14" x2="12" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="4" y1="22" x2="10" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="6" y1="30" x2="12" y2="30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="36" y1="14" x2="42" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="38" y1="22" x2="44" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="36" y1="30" x2="42" y2="30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  plumbing: {
    color: "#2563eb", // blue for water
    svg: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        {/* Pipe wrench */}
        <path d="M8 40 L20 18 C22 14 28 12 32 14 L36 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M34 8 L40 14 L36 10 Z" fill="currentColor" />
        {/* Wrench head */}
        <path d="M30 16 C33 13 37 15 36 18 L24 40" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        {/* Water drops */}
        <circle cx="14" cy="38" r="2" fill="currentColor" opacity="0.5" />
        <circle cx="18" cy="42" r="1.5" fill="currentColor" opacity="0.3" />
      </svg>
    ),
  },
  roofing: {
    color: "#7c3aed", // purple
    svg: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        {/* House roof shape */}
        <path d="M4 22 L24 6 L44 22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        {/* Roof lines */}
        <path d="M10 20 L24 8 L38 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.5" />
        {/* House walls */}
        <path d="M10 22 L10 40 L38 40 L38 22" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" fill="none" />
        {/* Door */}
        <rect x="20" y="28" width="8" height="12" rx="1" stroke="currentColor" strokeWidth="2" fill="none" />
        {/* Chimney */}
        <rect x="32" y="10" width="4" height="12" stroke="currentColor" strokeWidth="2" fill="none" />
      </svg>
    ),
  },
  landscaping: {
    color: "#16a34a", // green
    svg: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        {/* Tree */}
        <circle cx="24" cy="16" r="10" fill="currentColor" opacity="0.2" />
        <circle cx="24" cy="14" r="9" stroke="currentColor" strokeWidth="2.5" fill="none" />
        {/* Trunk */}
        <rect x="22" y="24" width="4" height="12" fill="currentColor" />
        {/* Ground line */}
        <line x1="6" y1="38" x2="42" y2="38" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        {/* Grass tufts */}
        <path d="M10 38 L8 34 M14 38 L12 34 M34 38 L36 34 M38 38 L40 34" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        {/* Small leaf details */}
        <path d="M20 10 L18 6 M24 8 L24 4 M28 10 L30 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  electrician: {
    color: "#eab308", // yellow for electricity
    svg: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        {/* Lightning bolt */}
        <path d="M28 4 L14 24 L22 24 L18 44 L36 20 L26 20 Z" fill="currentColor" />
        {/* Outlet */}
        <rect x="2" y="16" width="8" height="12" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
        <circle cx="5" cy="21" r="1" fill="currentColor" />
        <circle cx="7" cy="21" r="1" fill="currentColor" />
        <line x1="6" y1="24" x2="6" y2="26" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  painting: {
    color: "#ec4899", // pink
    svg: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        {/* Paint brush handle */}
        <line x1="30" y1="42" x2="40" y2="14" stroke="#8B5E3C" strokeWidth="3" strokeLinecap="round" />
        {/* Brush tip */}
        <path d="M38 14 C40 10 42 8 44 10 C46 12 42 16 38 14Z" fill="currentColor" />
        {/* Paint roller / brush head */}
        <rect x="20" y="8" width="16" height="8" rx="2" fill="currentColor" opacity="0.3" stroke="currentColor" strokeWidth="2" />
        {/* Paint drops */}
        <circle cx="10" cy="30" r="3" fill="currentColor" opacity="0.6" />
        <circle cx="16" cy="36" r="2" fill="currentColor" opacity="0.4" />
        <circle cx="8" cy="38" r="2" fill="currentColor" opacity="0.3" />
        {/* Color patches */}
        <rect x="6" y="12" width="8" height="6" rx="1" fill="currentColor" opacity="0.2" />
        <rect x="14" y="8" width="6" height="8" rx="1" fill="currentColor" opacity="0.15" />
      </svg>
    ),
  },
  "garage-door": {
    color: "#64748b", // slate
    svg: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        {/* Garage frame */}
        <rect x="6" y="14" width="36" height="28" rx="2" stroke="currentColor" strokeWidth="2.5" fill="none" />
        {/* Roof */}
        <path d="M4 16 L24 4 L44 16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        {/* Door panels */}
        <line x1="10" y1="22" x2="38" y2="22" stroke="currentColor" strokeWidth="1.5" />
        <line x1="10" y1="28" x2="38" y2="28" stroke="currentColor" strokeWidth="1.5" />
        <line x1="10" y1="34" x2="38" y2="34" stroke="currentColor" strokeWidth="1.5" />
        {/* Door handle */}
        <circle cx="24" cy="38" r="2" fill="currentColor" />
      </svg>
    ),
  },
  "tree-service": {
    color: "#15803d", // dark green
    svg: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        {/* Tree */}
        <path d="M20 36 L20 24 L14 24 L24 10 L34 24 L28 24 L28 36 Z" fill="currentColor" opacity="0.25" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        {/* Stump/cut */}
        <line x1="16" y1="36" x2="32" y2="36" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        {/* Axe */}
        <line x1="36" y1="44" x2="44" y2="20" stroke="#8B5E3C" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M42 18 L46 16 L44 22 L40 24 Z" fill="currentColor" />
      </svg>
    ),
  },
  windows: {
    color: "#0ea5e9", // sky blue
    svg: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        {/* Window frame */}
        <rect x="8" y="6" width="32" height="32" rx="2" stroke="currentColor" strokeWidth="2.5" fill="none" />
        {/* Cross bars */}
        <line x1="24" y1="6" x2="24" y2="38" stroke="currentColor" strokeWidth="2" />
        <line x1="8" y1="22" x2="40" y2="22" stroke="currentColor" strokeWidth="2" />
        {/* Glass panes (light blue) */}
        <rect x="10" y="8" width="12" height="12" fill="currentColor" opacity="0.15" />
        <rect x="26" y="8" width="12" height="12" fill="currentColor" opacity="0.15" />
        <rect x="10" y="24" width="12" height="12" fill="currentColor" opacity="0.15" />
        <rect x="26" y="24" width="12" height="12" fill="currentColor" opacity="0.15" />
        {/* Sill */}
        <rect x="4" y="38" width="40" height="4" rx="1" fill="currentColor" opacity="0.3" />
      </svg>
    ),
  },
  "pest-control": {
    color: "#b45309", // brown/amber
    svg: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        {/* Bug body */}
        <ellipse cx="24" cy="28" rx="8" ry="10" fill="currentColor" opacity="0.25" stroke="currentColor" strokeWidth="2" />
        {/* Head */}
        <circle cx="24" cy="16" r="4" fill="currentColor" opacity="0.25" stroke="currentColor" strokeWidth="2" />
        {/* Antennae */}
        <path d="M22 14 L16 6 M26 14 L32 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        {/* Legs */}
        <line x1="16" y1="24" x2="6" y2="20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="16" y1="28" x2="6" y2="28" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="16" y1="32" x2="6" y2="36" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="32" y1="24" x2="42" y2="20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="32" y1="28" x2="42" y2="28" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="32" y1="32" x2="42" y2="36" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        {/* X mark (exterminated) */}
        <line x1="38" y1="6" x2="46" y2="14" stroke="#dc2626" strokeWidth="3" strokeLinecap="round" />
        <line x1="46" y1="6" x2="38" y2="14" stroke="#dc2626" strokeWidth="3" strokeLinecap="round" />
      </svg>
    ),
  },
  "auto-repair": {
    color: "#475569", // slate gray
    svg: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        {/* Car body */}
        <path d="M4 30 L8 18 L16 14 L32 14 L40 18 L44 30" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" fill="none" />
        <line x1="4" y1="30" x2="44" y2="30" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        {/* Wheels */}
        <circle cx="14" cy="34" r="4" stroke="currentColor" strokeWidth="2.5" fill="none" />
        <circle cx="14" cy="34" r="1.5" fill="currentColor" />
        <circle cx="34" cy="34" r="4" stroke="currentColor" strokeWidth="2.5" fill="none" />
        <circle cx="34" cy="34" r="1.5" fill="currentColor" />
        {/* Wrench overlay */}
        <path d="M36 4 L32 8 L34 10 L30 14 L28 12 L24 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
      </svg>
    ),
  },
  dentist: {
    color: "#0891b2", // teal
    svg: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        {/* Tooth shape */}
        <path d="M24 4 C18 4 14 8 14 14 C14 20 12 28 16 34 C18 38 20 40 22 40 C24 40 24 36 24 36 C24 36 24 40 26 40 C28 40 30 38 32 34 C36 28 34 20 34 14 C34 8 30 4 24 4Z" stroke="currentColor" strokeWidth="2.5" fill="currentColor" opacity="0.15" />
        {/* Sparkle */}
        <path d="M38 6 L40 10 L44 12 L40 14 L38 18 L36 14 L32 12 L36 10 Z" fill="currentColor" opacity="0.6" />
      </svg>
    ),
  },
  movers: {
    color: "#7c3aed", // purple
    svg: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        {/* Box 1 */}
        <rect x="4" y="20" width="16" height="16" rx="1" stroke="currentColor" strokeWidth="2" fill="currentColor" opacity="0.15" />
        <line x1="4" y1="26" x2="20" y2="26" stroke="currentColor" strokeWidth="1.5" />
        <line x1="12" y1="20" x2="12" y2="26" stroke="currentColor" strokeWidth="1.5" />
        {/* Box 2 */}
        <rect x="22" y="12" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="2" fill="currentColor" opacity="0.2" />
        <line x1="22" y1="17" x2="34" y2="17" stroke="currentColor" strokeWidth="1.5" />
        <line x1="28" y1="12" x2="28" y2="17" stroke="currentColor" strokeWidth="1.5" />
        {/* Arrow */}
        <path d="M36 28 L44 28 M40 24 L44 28 L40 32" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  cleaning: {
    color: "#06b6d4", // cyan
    svg: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        {/* Spray bottle */}
        <rect x="14" y="20" width="12" height="18" rx="3" stroke="currentColor" strokeWidth="2.5" fill="currentColor" opacity="0.15" />
        <rect x="16" y="12" width="8" height="10" rx="2" stroke="currentColor" strokeWidth="2" fill="currentColor" opacity="0.1" />
        {/* Trigger */}
        <path d="M24 14 L30 10 L32 12 L26 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
        {/* Spray drops */}
        <circle cx="36" cy="8" r="1.5" fill="currentColor" opacity="0.4" />
        <circle cx="40" cy="12" r="1" fill="currentColor" opacity="0.3" />
        <circle cx="38" cy="6" r="1" fill="currentColor" opacity="0.2" />
        {/* Sparkles */}
        <path d="M36 18 L38 22 L42 24 L38 26 L36 30 L34 26 L30 24 L34 22 Z" fill="currentColor" opacity="0.5" />
      </svg>
    ),
  },
  pool: {
    color: "#0284c7", // deep blue
    svg: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        {/* Pool outline */}
        <ellipse cx="24" cy="30" rx="20" ry="10" stroke="currentColor" strokeWidth="2.5" fill="currentColor" opacity="0.1" />
        {/* Water waves */}
        <path d="M8 30 C12 26 16 34 20 30 C24 26 28 34 32 30 C36 26 40 34 40 30" stroke="currentColor" strokeWidth="2" fill="none" />
        {/* Pool edge */}
        <path d="M4 24 L4 34" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M44 24 L44 34" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        {/* Ladder */}
        <line x1="36" y1="10" x2="36" y2="22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="40" y1="10" x2="40" y2="22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="36" y1="14" x2="40" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="36" y1="18" x2="40" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
};

export type CategoryIconKey = keyof typeof categoryIcons;