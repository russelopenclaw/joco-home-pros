import fs from "fs";
import path from "path";
import matter from "gray-matter";

const guidesDirectory = path.join(process.cwd(), "src/content/guides");

export interface GuideBusiness {
  name: string;
  slug: string;
  rating: number;
  reviews: number;
  services: string;
  why: string;
}

export interface GuideTip {
  title: string;
  body: string;
}

export interface GuideCostRow {
  service: string;
  low: string;
  high: string;
  notes: string;
}

export interface GuideQuestion {
  q: string;
  a: string;
}

export interface GuideRelatedCity {
  name: string;
  slug: string;
}

export interface GuideData {
  slug: string;
  title: string;
  description: string;
  category: string;
  cities: string[];
  published: string;
  introHtml: string;
  tipsTitle: string;
  tips: GuideTip[];
  rankingsTitle: string;
  businesses: GuideBusiness[];
  costTitle: string;
  costTable: GuideCostRow[];
  costTip: string;
  decisionTitle: string;
  decisionHeaders: string[];
  decisionTable: string[][];
  questions: GuideQuestion[];
  relatedCities: GuideRelatedCity[];
}

// City name lookup
const cityNames: Record<string, string> = {
  "overland-park": "Overland Park",
  "olathe": "Olathe",
  "lenexa": "Lenexa",
  "shawnee": "Shawnee",
  "leawood": "Leawood",
  "merriam": "Merriam",
  "gardner": "Gardner",
  "de-soto": "De Soto",
  "prairie-village": "Prairie Village",
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInlineMarkdown(text: string): string {
  // Bold: **text**
  text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Links: [text](url)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 hover:text-blue-800 underline">$1</a>');
  return text;
}

function renderParagraphs(text: string): string {
  return text
    .split("\n\n")
    .map((p) => {
      const trimmed = p.trim();
      if (!trimmed) return "";
      return `<p class="text-gray-700 leading-relaxed mb-4">${renderInlineMarkdown(trimmed)}</p>`;
    })
    .join("\n");
}

function parseGuide(data: Record<string, any>, content: string): Omit<GuideData, "slug"> {
  const lines = content.split("\n");

  // Parse sections by ## headers
  const sections: Record<string, string> = {};
  let currentSection = "intro";
  let currentLines: string[] = [];

  for (const line of lines) {
    const h2Match = line.match(/^## (.+)$/);
    if (h2Match) {
      sections[currentSection] = currentLines.join("\n");
      currentSection = h2Match[1].trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  sections[currentSection] = currentLines.join("\n");

  // Parse intro
  const introHtml = renderParagraphs(sections["intro"] || "");

  // Find tips section by fuzzy match (key might be "What to Look for in an HVAC Company" etc.)
  const tipsSectionKey = Object.keys(sections).find((k) =>
    k.toLowerCase().includes("what to") || k.toLowerCase().includes("know") || k.toLowerCase().includes("look for")
  ) || "";
  const tipsSection = tipsSectionKey ? sections[tipsSectionKey] : "";

  // Parse businesses (### entries) — fuzzy match section key containing "top" or "best"
  const rankingsSectionKey = Object.keys(sections).find((k) =>
    k.toLowerCase().startsWith("top") || k.toLowerCase().startsWith("best")
  ) || "";
  const rankingsSection = rankingsSectionKey ? sections[rankingsSectionKey] : "";
  const tips: GuideTip[] = [];
  const tipLines = tipsSection.split("\n").filter((l) => l.trim());
  let currentTip: GuideTip | null = null;
  for (const line of tipLines) {
    const boldMatch = line.match(/^\*\*(.+?)\*\*\s*(.*)/);
    if (boldMatch) {
      if (currentTip) tips.push(currentTip);
      currentTip = { title: boldMatch[1], body: boldMatch[2] || "" };
    } else if (currentTip && line.trim()) {
      currentTip.body += (currentTip.body ? " " : "") + line.trim();
    }
  }
  if (currentTip) tips.push(currentTip);

  // Parse businesses (### entries) — use fuzzy-matched rankingsSection
  const businessBlocks = rankingsSection.split(/^### /m).filter((b) => b.trim());
  const businesses: GuideBusiness[] = [];
  for (const block of businessBlocks) {
    const bLines = block.split("\n");
    const name = bLines[0].replace(/^\d+\.\s*/, "").trim();
    let rating = 0, reviews = 0, services = "", why = "", slug = "";
    for (const line of bLines.slice(1)) {
      const ratingMatch = line.match(/\*\*Rating:\*\*\s*([\d.]+)\s*\(([\d,]+)\s*reviews?\)/i);
      if (ratingMatch) {
        rating = parseFloat(ratingMatch[1]);
        reviews = parseInt(ratingMatch[2].replace(/,/g, ""), 10);
      }
      const servicesMatch = line.match(/\*\*Services:\*\*\s*(.+)/i);
      if (servicesMatch) services = servicesMatch[1].trim();
      const whyMatch = line.match(/\*\*Why they stand out:\*\*\s*(.+)/i);
      if (whyMatch) why = whyMatch[1].trim();
      const slugMatch = line.match(/\/business\/([a-z0-9-]+)/);
      if (slugMatch) slug = slugMatch[1];
    }
    if (name) {
      businesses.push({ name, slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/g, ""), rating, reviews, services, why });
    }
  }

  // Parse cost table (| ... | format)
  const costSection = sections[data.costTitle || "Costs"] || "";
  const costTableMatch = Object.entries(sections).find(([k]) => k.toLowerCase().includes("cost"));
  const costContent = costSection || (costTableMatch ? costTableMatch[1] : "");
  const costRows: GuideCostRow[] = [];
  const costLines = costContent.split("\n");
  let costTip = "";
  for (const line of costLines) {
    if (line.startsWith("|") && line.endsWith("|") && !line.includes("---")) {
      const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
      if (cells.length >= 3 && !cells[0].match(/^service$/i)) {
        costRows.push({
          service: cells[0],
          low: cells[1].replace(/^\$/, ""),
          high: cells[2].replace(/^\$/, ""),
          notes: cells[3] || "",
        });
      }
    }
    const tipMatch = line.match(/\*\*Tip:\*\*\s*(.+)/);
    if (tipMatch) costTip = tipMatch[1];
  }

  // Parse decision table (| ... | format)
  const decisionSectionKey = Object.keys(sections).find((k) =>
    k.toLowerCase().includes("repair") || k.toLowerCase().includes("replace") || k.toLowerCase().includes("when")
  );
  const decisionContent = decisionSectionKey ? sections[decisionSectionKey] : "";
  const decisionHeaders: string[] = [];
  const decisionTable: string[][] = [];
  for (const line of decisionContent.split("\n")) {
    if (line.startsWith("|") && line.endsWith("|")) {
      const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
      if (cells.some((c) => c.match(/^-+$/))) continue; // separator row
      if (decisionHeaders.length === 0 && cells.length >= 2) {
        decisionHeaders.push(...cells);
      } else {
        decisionTable.push(cells);
      }
    }
  }

  // Parse questions (numbered list: 1. **Question** Answer) — fuzzy match section key
  const questionsSectionKey = Object.keys(sections).find((k) =>
    k.toLowerCase().includes("question")
  ) || "";
  const questionsSection = questionsSectionKey ? sections[questionsSectionKey] : "";
  const questions: GuideQuestion[] = [];
  for (const line of questionsSection.split("\n")) {
    const qMatch = line.match(/^\d+\.\s*\*\*(.+?)\*\*\s*(.*)/);
    if (qMatch) {
      questions.push({ q: qMatch[1], a: qMatch[2] || "" });
    }
  }

  // Parse related cities from links in the content
  const relatedCities: GuideRelatedCity[] = [];
  // Match both [text](/category/city) and /category/city formats
  const cityRegex = /\/([a-z-]+)\/([a-z-]+)[/\s"')→]/g;
  let match;
  const categorySlug = data.category || "";
  while ((match = cityRegex.exec(content)) !== null) {
    const cat = match[1];
    const city = match[2];
    if (cat === categorySlug && cityNames[city]) {
      if (!relatedCities.find((c) => c.slug === city)) {
        relatedCities.push({ name: cityNames[city], slug: city });
      }
    }
  }

  return {
    title: data.title || "",
    description: data.description || "",
    category: data.category || "",
    cities: data.cities || [],
    published: data.published || "",
    introHtml,
    tipsTitle: data.tipsTitle || "What to Know",
    tips,
    rankingsTitle: data.rankingsTitle || "Top Rated",
    businesses,
    costTitle: data.costTitle || "Costs: What to Expect",
    costTable: costRows,
    costTip,
    decisionTitle: decisionSectionKey || "",
    decisionHeaders,
    decisionTable,
    questions,
    relatedCities,
  };
}

export function getGuideBySlug(slug: string): GuideData | null {
  try {
    const filePath = path.join(guidesDirectory, `${slug}.md`);
    const fileContents = fs.readFileSync(filePath, "utf8");
    const { data, content } = matter(fileContents);
    const parsed = parseGuide(data, content);
    return { slug, ...parsed };
  } catch {
    return null;
  }
}

export function getAllGuides(): GuideData[] {
  const fileNames = fs.readdirSync(guidesDirectory);
  return fileNames
    .filter((name) => name.endsWith(".md"))
    .map((name) => {
      const slug = name.replace(/\.md$/, "");
      return getGuideBySlug(slug);
    })
    .filter((g): g is GuideData => g !== null);
}

export function getAllGuideSlugs(): string[] {
  const fileNames = fs.readdirSync(guidesDirectory);
  return fileNames
    .filter((name) => name.endsWith(".md"))
    .map((name) => name.replace(/\.md$/, ""));
}