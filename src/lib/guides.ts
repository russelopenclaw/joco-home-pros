import fs from "fs";
import path from "path";
import matter from "gray-matter";

const guidesDirectory = path.join(process.cwd(), "src/content/guides");

export interface GuideData {
  slug: string;
  title: string;
  description: string;
  category: string;
  cities: string[];
  published: string;
  content: string;
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

export function getGuideBySlug(slug: string): GuideData | null {
  try {
    const filePath = path.join(guidesDirectory, `${slug}.md`);
    const fileContents = fs.readFileSync(filePath, "utf8");
    const { data, content } = matter(fileContents);

    return {
      slug,
      title: data.title || "",
      description: data.description || "",
      category: data.category || "",
      cities: data.cities || [],
      published: data.published || "",
      content,
    };
  } catch {
    return null;
  }
}

export function getAllGuideSlugs(): string[] {
  const fileNames = fs.readdirSync(guidesDirectory);
  return fileNames
    .filter((name) => name.endsWith(".md"))
    .map((name) => name.replace(/\.md$/, ""));
}