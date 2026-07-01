"use client";

import { useState } from "react";

type SortKey = "rating" | "name" | "reviews";

function StarRating({ rating }: { rating: number | null }) {
  if (!rating) return null;
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return (
    <span className="text-yellow-500">
      {"★".repeat(full)}{half ? "½" : ""}{"☆".repeat(empty)}
      <span className="text-gray-600 text-sm ml-1">{rating.toFixed(1)}</span>
    </span>
  );
}

const sortLabels: Record<SortKey, string> = {
  rating: "Rating",
  name: "A-Z",
  reviews: "Reviews",
};

export default function BusinessList({ businesses }: { businesses: any[] }) {
  const [sortBy, setSortBy] = useState<SortKey>("rating");

  const sorted = [...businesses].sort((a, b) => {
    switch (sortBy) {
      case "rating":
        // Sponsored first, then by rating desc
        if (a.is_sponsored && !b.is_sponsored) return -1;
        if (!a.is_sponsored && b.is_sponsored) return 1;
        return (b.rating ?? 0) - (a.rating ?? 0);
      case "name":
        return a.name.localeCompare(b.name);
      case "reviews":
        return (b.review_count ?? 0) - (a.review_count ?? 0);
    }
  });

  return (
    <>
      {/* Sort controls */}
      {businesses.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 mb-4 text-sm">
          <span className="text-gray-500 font-medium">Sort by:</span>
          {(Object.keys(sortLabels) as SortKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={`px-3 py-1 rounded-full border transition ${
                sortBy === key
                  ? "bg-blue-700 text-white border-blue-700"
                  : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
              }`}
            >
              {sortLabels[key]}
            </button>
          ))}
        </div>
      )}

      {/* Business cards — mobile-optimized */}
      {sorted.map((biz: any) => (
        <div
          key={biz.id}
          className={`border rounded-lg mb-4 hover:shadow-md hover:border-blue-400 transition overflow-hidden ${
            biz.is_sponsored ? "border-blue-600 border-2 relative" : ""
          }`}
        >
          {biz.is_sponsored && (
            <div className="bg-blue-700 text-white text-xs font-bold px-3 py-1 uppercase tracking-wide">
              Sponsored
            </div>
          )}

          <div className="p-4 sm:p-6">
            {/* Business name */}
            <a href={`/business/${biz.slug}`} className="hover:underline">
              <h3 className="text-lg font-bold text-blue-700 leading-snug">{biz.name}</h3>
            </a>

            {/* Rating + reviews */}
            <div className="flex items-center gap-2 mt-1">
              <StarRating rating={biz.rating} />
              {biz.review_count > 0 && (
                <span className="text-gray-500 text-sm">({biz.review_count} reviews)</span>
              )}
            </div>

            {/* Address — truncated on mobile */}
            {biz.address && (
              <p className="text-gray-500 text-sm mt-2 truncate">{biz.address}</p>
            )}

            {/* Description — only if real content */}
            {biz.description && biz.description.trim() && (
              <p className="mt-3 text-gray-700 leading-relaxed text-sm sm:text-base line-clamp-2">
                {biz.description}
              </p>
            )}

            {/* Services tags */}
            {biz.services && biz.services.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {biz.services.map((s: string) => (
                  <span
                    key={s}
                    className="bg-blue-50 text-blue-700 text-xs font-medium px-2 py-0.5 rounded"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}

            {/* Action buttons — stack on mobile, row on desktop */}
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:gap-3 gap-2">
              {biz.phone && (
                <a
                  href={`tel:${biz.phone}`}
                  className="flex items-center justify-center sm:justify-start gap-1.5 bg-blue-700 text-white py-2.5 px-4 rounded-lg font-semibold text-sm hover:bg-blue-800 transition"
                  onClick={(e) => e.stopPropagation()}
                >
                  📞 <span className="sm:hidden">Call</span><span className="hidden sm:inline">{biz.phone}</span>
                </a>
              )}
              {biz.website && (
                <a
                  href={biz.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center sm:justify-start gap-1.5 border border-blue-700 text-blue-700 py-2.5 px-4 rounded-lg font-semibold text-sm hover:bg-blue-50 transition"
                  onClick={(e) => e.stopPropagation()}
                >
                  🌐 Visit Website
                </a>
              )}
              <a
                href={`/business/${biz.slug}`}
                className="flex items-center justify-center sm:justify-start gap-1 text-blue-700 font-semibold text-sm hover:underline sm:ml-auto"
              >
                View Details →
              </a>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}