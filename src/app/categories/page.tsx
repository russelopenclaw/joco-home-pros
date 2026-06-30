import { getCategories } from "@/lib/supabase";
import { generatePageSEO } from "@/lib/seo";
import type { Metadata } from "next";

export const metadata = generatePageSEO({
  title: "All Home Services in Johnson County, KS",
  description: "Browse all home service categories in Johnson County, KS. HVAC, plumbing, roofing, landscaping, electrical, and more.",
  path: "/categories",
});

export const revalidate = 3600;

const categoryEmojis: Record<string, string> = {
  hvac: "🌡️", plumbing: "🔧", roofing: "🏠", landscaping: "🌿",
  electrician: "⚡", painting: "🎨", "garage-door": "🚪", "tree-service": "🌲",
  windows: "🪟", "pest-control": "🐛", "auto-repair": "🚗", dentist: "😁",
  movers: "📦", cleaning: "✨", pool: "🏊",
};

export default async function CategoriesPage() {
  const categories = await getCategories();

  return (
    <section className="max-w-5xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-2">All Home Services</h1>
      <p className="text-gray-600 mb-8">
        Browse 15 home service categories across Johnson County, Kansas.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {categories.map((cat: any) => (
          <a key={cat.slug} href={`/${cat.slug}`}
            className="border rounded-lg p-6 text-center hover:border-blue-400 hover:shadow-md transition">
            <div className="text-4xl mb-3">{categoryEmojis[cat.slug] || "🔧"}</div>
            <h2 className="font-bold text-lg">{cat.name}</h2>
            <p className="text-sm text-gray-500 mt-2 line-clamp-2">{cat.description}</p>
          </a>
        ))}
      </div>
    </section>
  );
}