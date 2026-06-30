import { getCategories } from "@/lib/supabase";
import { generatePageSEO } from "@/lib/seo";
import { categoryIcons } from "@/components/CategoryIcons";
import type { Metadata } from "next";

export const metadata = generatePageSEO({
  title: "All Home Services in Johnson County, KS",
  description: "Browse all home service categories in Johnson County, KS. HVAC, plumbing, roofing, landscaping, electrical, and more.",
  path: "/categories",
});

export const revalidate = 3600;

const categoryColors: Record<string, string> = {
  hvac: "#dc2626", plumbing: "#2563eb", roofing: "#7c3aed", landscaping: "#16a34a",
  electrician: "#eab308", painting: "#ec4899", "garage-door": "#64748b", "tree-service": "#15803d",
  windows: "#0ea5e9", "pest-control": "#b45309", "auto-repair": "#475569", dentist: "#0891b2",
  movers: "#7c3aed", cleaning: "#06b6d4", pool: "#0284c7",
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
            <div className="flex justify-center mb-3" style={{ color: categoryColors[cat.slug] || "#2563eb" }}>
              {categoryIcons[cat.slug]?.svg || <span className="text-4xl">🔧</span>}
            </div>
            <h2 className="font-bold text-lg">{cat.name}</h2>
            <p className="text-sm text-gray-500 mt-2 line-clamp-2">{cat.description}</p>
          </a>
        ))}
      </div>
    </section>
  );
}