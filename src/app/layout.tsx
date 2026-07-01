import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "JoCo Home Pros — Find Trusted Home Services in Johnson County, KS",
    template: "%s | JoCo Home Pros",
  },
  description:
    "Find the best home service professionals in Johnson County, Kansas. Trusted HVAC, plumbing, roofing, landscaping, and more in Overland Park, Olathe, Lenexa, Leawood, and surrounding areas.",
  keywords: [
    "Johnson County Kansas",
    "home services",
    "HVAC Overland Park",
    "plumber Olathe",
    "roofing Lenexa",
    "landscaping Leawood",
    "electrician Shawnee",
    "home repair JoCo",
    "contractors Kansas",
  ],
  openGraph: {
    siteName: "JoCo Home Pros",
    locale: "en_US",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 text-gray-900 antialiased`}>
        <Header />
        <main className="min-h-screen">{children}</main>
        <footer className="border-t border-gray-200 bg-gray-900 text-gray-400">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              <div>
                <h3 className="text-lg font-semibold text-white">JoCo Home Pros</h3>
                <p className="mt-2 text-sm">
                  The trusted directory for home service professionals in Johnson County, Kansas.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-white">Popular Services</h4>
                <ul className="mt-2 space-y-1 text-sm">
                  <li><a href="/hvac" className="hover:text-white">HVAC Repair</a></li>
                  <li><a href="/plumbing" className="hover:text-white">Plumbing</a></li>
                  <li><a href="/roofing" className="hover:text-white">Roofing</a></li>
                  <li><a href="/landscaping" className="hover:text-white">Landscaping</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-white">Cities</h4>
                <ul className="mt-2 space-y-1 text-sm">
                  <li><a href="/overland-park" className="hover:text-white">Overland Park</a></li>
                  <li><a href="/olathe" className="hover:text-white">Olathe</a></li>
                  <li><a href="/lenexa" className="hover:text-white">Lenexa</a></li>
                  <li><a href="/leawood" className="hover:text-white">Leawood</a></li>
                </ul>
              </div>
            </div>
            <div className="mt-8 border-t border-gray-700 pt-8 text-center text-sm">
              <p>© {new Date().getFullYear()} JoCo Home Pros. All rights reserved.</p>
              <p className="mt-1">
                Serving Johnson County, Kansas — Overland Park, Olathe, Lenexa, Leawood, Shawnee, Gardner, Prairie Village, Merriam, De Soto
              </p>
              <p className="mt-2 text-xs text-gray-500">
                Garage door icon by emil robinson, paint icon by emil robinson — Noun Project (CC BY 3.0)
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}

function Header() {
  const navLinks = [
    { href: "/hvac", label: "HVAC" },
    { href: "/plumbing", label: "Plumbing" },
    { href: "/roofing", label: "Roofing" },
    { href: "/landscaping", label: "Landscaping" },
    { href: "/electrician", label: "Electrician" },
    { href: "/handyman", label: "Handyman" },
    { href: "/categories", label: "All Services →" },
  ];

  return (
    <header className="border-b border-gray-200 bg-white">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <a href="/" className="flex items-center gap-2 text-xl font-bold text-blue-700">
          🏠 JoCo Home Pros
        </a>
        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} className="hover:text-blue-700">
              {link.label}
            </a>
          ))}
        </div>
        {/* Mobile menu toggle */}
        <button
          className="md:hidden text-gray-600 p-2 -mr-2"
          aria-label="Menu"
          aria-expanded="false"
          data-mobile-menu-toggle
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
      </nav>
      {/* Mobile menu dropdown */}
      <div className="md:hidden hidden border-t border-gray-200 bg-white" data-mobile-menu>
        <div className="px-4 py-3 space-y-2">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="block py-2 text-gray-700 hover:text-blue-700 font-medium"
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
      <script dangerouslySetInnerHTML={{ __html: `
        document.querySelector('[data-mobile-menu-toggle]')?.addEventListener('click', function() {
          var menu = document.querySelector('[data-mobile-menu]');
          var btn = this;
          var isOpen = !menu.classList.contains('hidden');
          menu.classList.toggle('hidden');
          btn.setAttribute('aria-expanded', !isOpen);
        });
      `}} />
    </header>
  );
}