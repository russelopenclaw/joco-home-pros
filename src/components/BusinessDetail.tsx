"use client";

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

function HoursDisplay({ hours }: { hours: string[] | null }) {
  if (!hours || hours.length === 0) return null;
  return (
    <div className="mt-4">
      <h3 className="font-semibold text-gray-800 mb-2">Hours</h3>
      <div className="text-sm text-gray-600 space-y-1">
        {hours.map((line, i) => (
          <div key={i} className="flex justify-between max-w-xs">
            <span className="font-medium">{line}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BusinessDetail({ business, category, city, related, categories }: {
  business: any;
  category: any;
  city: any;
  related: any[];
  categories: any[];
}) {
  const catSlug = category?.slug || "";
  const citySlug = city?.slug || "";
  const catName = category?.name || "Home Services";
  const cityName = city?.name || "Johnson County";

  return (
    <>
      {/* Breadcrumb */}
      <section className="bg-gray-50 border-b py-3 px-4">
        <div className="max-w-5xl mx-auto text-sm text-gray-500">
          <a href="/" className="hover:text-blue-700">Home</a> ›{" "}
          <a href={`/${catSlug}`} className="hover:text-blue-700">{catName}</a> ›{" "}
          <a href={`/${catSlug}/${citySlug}`} className="hover:text-blue-700">{cityName}</a> ›{" "}
          <span className="text-gray-800">{business.name}</span>
        </div>
      </section>

      {/* Main content */}
      <section className="max-w-5xl mx-auto py-8 px-4">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Left: Main info */}
          <div className="md:col-span-2">
            {/* Business photo */}
            {business.image_url && (
              <div className="mb-4 rounded-lg overflow-hidden bg-gray-100">
                <img
                  src={business.image_url}
                  alt={business.name}
                  className="w-full h-64 object-cover"
                  loading="lazy"
                />
              </div>
            )}
            {/* Business name + rating */}
            <h1 className="text-3xl font-bold text-gray-900">{business.name}</h1>
            <div className="flex items-center gap-3 mt-2">
              <StarRating rating={business.rating} />
              {business.review_count > 0 && (
                <span className="text-gray-500 text-sm">({business.review_count} reviews)</span>
              )}
              {business.google_rating && business.google_rating !== business.rating && (
                <span className="text-gray-400 text-sm">Google: {business.google_rating}</span>
              )}
            </div>

            {/* Description */}
            {business.description && business.description.trim() && (
              <p className="mt-4 text-gray-700 leading-relaxed text-lg">{business.description}</p>
            )}

            {/* Contact info */}
            <div className="mt-6 space-y-3">
              {business.phone && (
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📞</span>
                  <a href={`tel:${business.phone}`} className="text-blue-700 text-lg font-semibold hover:underline">
                    {business.phone}
                  </a>
                </div>
              )}
              {business.website && (
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🌐</span>
                  <a href={business.website} target="_blank" rel="noopener noreferrer"
                    className="text-blue-700 hover:underline break-all">
                    {business.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  </a>
                </div>
              )}
              {business.address && (
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📍</span>
                  <span className="text-gray-700">{business.address}</span>
                </div>
              )}
              {business.google_maps_url && (
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🗺️</span>
                  <a href={business.google_maps_url} target="_blank" rel="noopener noreferrer"
                    className="text-blue-700 hover:underline">
                    Get Directions on Google Maps
                  </a>
                </div>
              )}
            </div>

            {/* Services */}
            {business.services && business.services.length > 0 && (
              <div className="mt-6">
                <h3 className="font-semibold text-gray-800 mb-2">Services</h3>
                <div className="flex flex-wrap gap-2">
                  {business.services.map((s: string) => (
                    <span key={s} className="bg-blue-50 text-blue-700 text-sm font-medium px-3 py-1 rounded-full">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Hours */}
            <HoursDisplay hours={business.hours} />
          </div>

          {/* Right sidebar: Map + quick actions */}
          <div className="md:col-span-1">
            {/* Map */}
            {business.latitude && business.longitude && (
              <div className="rounded-lg overflow-hidden border bg-gray-100">
                <iframe
                  width="100%"
                  height="250"
                  style={{ border: 0 }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://maps.google.com/maps?q=${business.latitude},${business.longitude}&z=14&output=embed`}
                  title={`${business.name} location`}
                />
              </div>
            )}

            {/* Quick actions */}
            <div className="mt-4 space-y-3">
              {business.phone && (
                <a href={`tel:${business.phone}`}
                  className="block w-full text-center bg-blue-700 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-800 transition">
                  📞 Call {business.name}
                </a>
              )}
              {business.website && (
                <a href={business.website} target="_blank" rel="noopener noreferrer"
                  className="block w-full text-center border border-blue-700 text-blue-700 py-3 px-4 rounded-lg font-semibold hover:bg-blue-50 transition">
                  🌐 Visit Website
                </a>
              )}
            </div>

            {/* Business status */}
            {business.business_status && (
              <div className="mt-4 p-3 rounded-lg bg-green-50 border border-green-200">
                <span className="text-green-700 font-medium">
                  ✅ {business.business_status === "OPERATIONAL" ? "Open for Business" : business.business_status}
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Related businesses */}
      {related.length > 0 && (
        <section className="bg-gray-50 py-8 px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-xl font-bold mb-4">Other {catName} in {cityName}</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {related.map((biz: any) => (
                <a key={biz.id} href={`/business/${biz.slug}`}
                  className="border rounded-lg p-4 hover:border-blue-400 hover:shadow-sm transition bg-white">
                  <h3 className="font-semibold text-blue-700">{biz.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    {biz.rating && <StarRating rating={biz.rating} />}
                    {biz.review_count > 0 && (
                      <span className="text-gray-500 text-xs">({biz.review_count})</span>
                    )}
                  </div>
                  {biz.address && (
                    <p className="text-gray-500 text-sm mt-1 line-clamp-1">{biz.address}</p>
                  )}
                </a>
              ))}
            </div>
            <a href={`/${catSlug}/${citySlug}`}
              className="mt-4 inline-block text-blue-700 hover:underline text-sm font-medium">
              View all {catName.toLowerCase()} in {cityName} →
            </a>
          </div>
        </section>
      )}

      {/* Cross-category links */}
      <section className="max-w-5xl mx-auto py-8 px-4">
        <h2 className="text-xl font-bold mb-4">{catName} in Other Johnson County Cities</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {categories.filter((c: any) => c.slug !== catSlug).slice(0, 8).map((c: any) => (
            <a key={c.slug} href={`/${c.slug}/${citySlug}`}
              className="border rounded-lg p-3 hover:border-blue-400 transition text-center">
              <span className="font-medium text-sm">{c.name} in {cityName}</span>
            </a>
          ))}
        </div>
      </section>
    </>
  );
}