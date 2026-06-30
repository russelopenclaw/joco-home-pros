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
        <div className="flex items-center gap-2 mb-4 text-sm">
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

      {/* Business cards */}
      {sorted.map((biz: any) => (
        <div
          key={biz.id}
          className={`border rounded-lg p-6 mb-4 ${
            biz.is_sponsored ? "border-blue-600 border-2 relative" : ""
          }`}
        >
          {biz.is_sponsored && (
            <div className="absolute -top-3 left-4 bg-blue-700 text-white text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wide">
              Sponsored
            </div>
          )}
          <h3 className="text-lg font-bold text-blue-700">{biz.name}</h3>
          <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
            <StarRating rating={biz.rating} />
            {biz.review_count > 0 && (
              <span>({biz.review_count} reviews)</span>
            )}
            {biz.address && <span>📍 {biz.address}</span>}
          </div>
          {biz.description && biz.description.trim() && (
            <p className="mt-3 text-gray-700 leading-relaxed">
              {biz.description}
            </p>
          )}
          {biz.services && biz.services.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {biz.services.map((s: string) => (
                <span
                  key={s}
                  className="bg-blue-50 text-blue-700 text-xs font-medium px-2 py-1 rounded"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
          <div className="mt-4 flex gap-4">
            {biz.phone && (
              <a
                href={`tel:${biz.phone}`}
                className="text-blue-700 font-semibold text-sm hover:underline"
              >
                📞 {biz.phone}
              </a>
            )}
            {biz.website && (
              <a
                href={biz.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-700 font-semibold text-sm hover:underline"
              >
                🌐 Visit Website
              </a>
            )}
            {biz.affiliate_url && (
              <a
                href={biz.affiliate_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-700 font-semibold text-sm hover:underline"
              >
                📋 Get Free Quote
              </a>
            )}
          </div>
        </div>
      ))}
    </>
  );
}