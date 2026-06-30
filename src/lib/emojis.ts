// Best available emoji for each service category
// Chosen for clarity and specificity:
// - 🪠 Plunger (most plumbing-specific emoji)
// - 🌱 Seedling (lawn care feel)
// - 🖌️ Paintbrush (not palette)
// - 🌳 Deciduous tree (not evergreen/Christmas tree)
// - 🐜 Ant (classic pest)
// - 🦷 Tooth (literal tooth!)
// - 🚚 Moving truck (not just a box)
// - 🧽 Sponge (most cleaning-specific)
// - 🚙 SUV (service vehicle feel)
export const categoryEmojis: Record<string, string> = {
  hvac: "🌡️",
  plumbing: "🪠",
  roofing: "🏠",
  landscaping: "🌱",
  electrician: "⚡",
  painting: "🖌️",
  "garage-door": "🚪",
  "tree-service": "🌳",
  windows: "🪟",
  "pest-control": "🐜",
  "auto-repair": "🚙",
  dentist: "🦷",
  movers: "🚚",
  cleaning: "🧽",
  pool: "🏊",
};