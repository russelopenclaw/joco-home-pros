import type { Category } from "./types";

export const categories: Category[] = [
  {
    id: "hvac",
    name: "HVAC & Heating Cooling",
    slug: "hvac",
    description:
      "Top-rated HVAC contractors in Johnson County, KS. Expert heating, cooling, and air conditioning repair, installation, and maintenance for Overland Park, Olathe, Lenexa, and surrounding areas.",
    parent_id: null,
    icon: "Thermometer",
  },
  {
    id: "plumbing",
    name: "Plumbing",
    slug: "plumbing",
    description:
      "Trusted plumbers in Johnson County, KS. Emergency plumbing, drain cleaning, water heater repair, and full plumbing services for Overland Park, Olathe, Lenexa, and surrounding areas.",
    parent_id: null,
    icon: "Droplets",
  },
  {
    id: "roofing",
    name: "Roofing",
    slug: "roofing",
    description:
      "Professional roofing contractors in Johnson County, KS. Roof repair, replacement, and storm damage restoration for Overland Park, Olathe, Lenexa, and surrounding areas.",
    parent_id: null,
    icon: "Home",
  },
  {
    id: "landscaping",
    name: "Landscaping & Lawn Care",
    slug: "landscaping",
    description:
      "Best landscaping and lawn care services in Johnson County, KS. Lawn maintenance, landscape design, tree service, and outdoor living for Overland Park, Olathe, Lenexa, and surrounding areas.",
    parent_id: null,
    icon: "Trees",
  },
  {
    id: "electrician",
    name: "Electrician",
    slug: "electrician",
    description:
      "Licensed electricians in Johnson County, KS. Electrical repair, panel upgrades, lighting installation, and wiring for Overland Park, Olathe, Lenexa, and surrounding areas.",
    parent_id: null,
    icon: "Zap",
  },
  {
    id: "painting",
    name: "Painting",
    slug: "painting",
    description:
      "Top painting contractors in Johnson County, KS. Interior and exterior painting, cabinet refinishing, and wallpaper removal for Overland Park, Olathe, Lenexa, and surrounding areas.",
    parent_id: null,
    icon: "Paintbrush",
  },
  {
    id: "garage-door",
    name: "Garage Door Repair",
    slug: "garage-door",
    description:
      "Reliable garage door repair and installation in Johnson County, KS. Spring replacement, opener repair, and new garage doors for Overland Park, Olathe, Lenexa, and surrounding areas.",
    parent_id: null,
    icon: "DoorOpen",
  },
  {
    id: "tree-service",
    name: "Tree Service & Removal",
    slug: "tree-service",
    description:
      "Professional tree service in Johnson County, KS. Tree removal, trimming, stump grinding, and emergency storm cleanup for Overland Park, Olathe, Lenexa, and surrounding areas.",
    parent_id: null,
    icon: "TreePine",
  },
  {
    id: "windows",
    name: "Window Replacement",
    slug: "windows",
    description:
      "Top window replacement companies in Johnson County, KS. Energy-efficient window installation, repair, and custom windows for Overland Park, Olathe, Lenexa, and surrounding areas.",
    parent_id: null,
    icon: "Square",
  },
  {
    id: "pest-control",
    name: "Pest Control",
    slug: "pest-control",
    description:
      "Best pest control services in Johnson County, KS. Termite treatment, rodent control, insect extermination, and preventative pest management for Overland Park, Olathe, Lenexa, and surrounding areas.",
    parent_id: null,
    icon: "Bug",
  },
  {
    id: "auto-repair",
    name: "Auto Repair",
    slug: "auto-repair",
    description:
      "Trusted auto repair shops in Johnson County, KS. Oil changes, brake repair, engine diagnostics, and complete car care for Overland Park, Olathe, Lenexa, and surrounding areas.",
    parent_id: null,
    icon: "Car",
  },
  {
    id: "dentist",
    name: "Dentist & Orthodontist",
    slug: "dentist",
    description:
      "Top-rated dentists and orthodontists in Johnson County, KS. General dentistry, cosmetic dentistry, braces, Invisalign, and dental implants for Overland Park, Olathe, Lenexa, and surrounding areas.",
    parent_id: null,
    icon: "Smile",
  },
  {
    id: "movers",
    name: "Movers & Moving Company",
    slug: "movers",
    description:
      "Best moving companies in Johnson County, KS. Local and long-distance movers, packing services, and storage solutions for Overland Park, Olathe, Lenexa, and surrounding areas.",
    parent_id: null,
    icon: "Truck",
  },
  {
    id: "cleaning",
    name: "Home Cleaning",
    slug: "cleaning",
    description:
      "Top home cleaning services in Johnson County, KS. House cleaning, deep cleaning, move-in/move-out cleaning, and recurring maid service for Overland Park, Olathe, Lenexa, and surrounding areas.",
    parent_id: null,
    icon: "Sparkles",
  },
  {
    id: "pool",
    name: "Pool Service & Maintenance",
    slug: "pool",
    description:
      "Professional pool service in Johnson County, KS. Pool maintenance, repair, opening and closing, and chemical balancing for Overland Park, Olathe, Lenexa, and surrounding areas.",
    parent_id: null,
    icon: "Waves",
  },
];

export function getCategoryBySlug(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}