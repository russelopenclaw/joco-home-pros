import { categories } from "@/lib/categories";
import { generatePageSEO } from "@/lib/seo";
import type { Metadata } from "next";

export const metadata = generatePageSEO({
  title: "All Home Services in Johnson County, KS",
  description:
    "Browse all home service categories in Johnson County, Kansas. HVAC, plumbing, roofing, landscaping, electricians, and more — find trusted local professionals.",
  path: "/categories",
});

export default function CategoriesPage() {
  return (
    <div>
      <section className="bg-gradient-to-br from-blue-700 to-blue-900 py-12 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <nav className="text-sm text-blue-200">
            <a href="/" className="hover:text-white">Home</a>
            <span className="mx-2">›</span>
            <span>All Services</span>
          </nav>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
            Home Services in Johnson County, KS
          </h1>
          <p className="mt-3 text-lg text-blue-100">
            {categories.length} service categories covering all your home needs.
            From HVAC to landscaping, find trusted professionals in your area.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => (
            <a
              key={cat.id}
              href={`/${cat.slug}`}
              className="group rounded-lg border border-gray-200 bg-white p-6 transition hover:border-blue-300 hover:shadow-lg"
            >
              <h2 className="text-xl font-bold text-gray-900 group-hover:text-blue-700">
                {cat.name}
              </h2>
              <p className="mt-2 text-sm text-gray-600 line-clamp-3">
                {cat.description}
              </p>
              <span className="mt-3 inline-block text-sm font-medium text-blue-700">
                Browse {cat.name.toLowerCase()} →
              </span>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}