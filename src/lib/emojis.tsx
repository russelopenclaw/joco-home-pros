// Category icons: emoji for most, SVG for garage-door and painting
// SVGs sourced from Noun Project (attribution in site footer)
import { categorySvgs } from "./categorySvgs";

export const categoryEmojis: Record<string, string> = {
  hvac: "🌡️",
  plumbing: "🪠",
  roofing: "🏠",
  landscaping: "🌱",
  electrician: "⚡",
  painting: "🖌️", // fallback - SVG used instead
  "garage-door": "🚪", // fallback - SVG used instead
  "tree-service": "🌳",
  windows: "🪟",
  "pest-control": "🐜",
  "auto-repair": "🚙",
  dentist: "🦷",
  movers: "🚚",
  cleaning: "🧽",
  pool: "🏊",
  handyman: "🔨",
};

// Returns the icon component for a category slug
// Uses SVG for garage-door and painting, emoji for everything else
export function getCategoryIcon(slug: string): React.ReactNode {
  if (categorySvgs[slug]) {
    return (
      <span
        dangerouslySetInnerHTML={{ __html: categorySvgs[slug].svg }}
        style={{ color: categorySvgs[slug].color, display: "inline-block", width: "1.5em", height: "1.5em" }}
      />
    );
  }
  return <span>{categoryEmojis[slug] || "🔧"}</span>;
}