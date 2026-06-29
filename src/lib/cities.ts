import type { City } from "./types";

export const cities: City[] = [
  {
    id: "overland-park",
    name: "Overland Park",
    slug: "overland-park",
    state: "KS",
    population: 202893,
    description:
      "Overland Park is the second-largest city in Kansas and the crown jewel of Johnson County. With a population of over 200,000, it combines upscale suburban living with thriving business districts. Home to the corporate headquarters of Sprint (now T-Mobile) and numerous Fortune 500 satellite offices, Overland Park residents expect quality service from top-rated home professionals. The city's extensive park system, excellent schools, and strong housing market make it a prime area for home services.",
  },
  {
    id: "olathe",
    name: "Olathe",
    slug: "olathe",
    state: "KS",
    population: 145057,
    description:
      "Olathe is the fourth-largest city in Kansas and one of the fastest-growing communities in the Kansas City metro area. With a population exceeding 145,000, Olathe offers a blend of historic charm and modern development. The city's expanding housing market, excellent schools, and family-friendly neighborhoods create strong demand for reliable home service professionals.",
  },
  {
    id: "lenexa",
    name: "Lenexa",
    slug: "lenexa",
    state: "KS",
    population: 59427,
    description:
      "Lenexa is a thriving suburb known as the 'City of Festivals,' with a population of nearly 60,000. Its strategic location at the crossroads of major highways makes it a business hub, while its residential neighborhoods feature a mix of established homes and new construction. Lenexa's growing population and active home improvement market make it a key area for home services.",
  },
  {
    id: "leawood",
    name: "Leawood",
    slug: "leawood",
    state: "KS",
    population: 34659,
    description:
      "Leawood is one of the most affluent communities in the Kansas City metro area, with a median household income well above the national average. This upscale suburb features luxury homes, manicured landscapes, and residents who invest heavily in home maintenance and improvement. Leawood homeowners demand premium service and are willing to pay for quality.",
  },
  {
    id: "shawnee",
    name: "Shawnee",
    slug: "shawnee",
    state: "KS",
    population: 67311,
    description:
      "Shawnee is a diverse, growing community of over 67,000 residents straddling the Kansas River. With a mix of established neighborhoods and new developments, Shawnee offers strong opportunities for home service professionals. The city's affordable housing stock and active remodeling market create consistent demand for contractors and tradespeople.",
  },
  {
    id: "gardner",
    name: "Gardner",
    slug: "gardner",
    state: "KS",
    population: 23878,
    description:
      "Gardner is a rapidly growing community in southern Johnson County with a population approaching 24,000. New housing developments and a family-oriented atmosphere make it an emerging market for home services. As one of the fastest-growing cities in Kansas, Gardner represents an expanding opportunity for home service businesses.",
  },
  {
    id: "prairie-village",
    name: "Prairie Village",
    slug: "prairie-village",
    state: "KS",
    population: 23229,
    description:
      "Prairie Village is a charming, well-established suburb known for its tree-lined streets, quality schools, and strong sense of community. With many homes dating from the 1940s-1960s, there is consistent demand for renovation, repair, and updating services. The city's residents value trusted, reliable professionals for their beloved older homes.",
  },
  {
    id: "merriam",
    name: "Merriam",
    slug: "merriam",
    state: "KS",
    population: 10995,
    description:
      "Merriam is a compact, centrally located community in the heart of Johnson County. Its convenient location along I-35 and Shawnee Mission Parkway makes it a strategic base for home service businesses serving the broader metro area. Merriam's established neighborhoods and ongoing renovation activity create steady demand for quality contractors.",
  },
  {
    id: "de-soto",
    name: "De Soto",
    slug: "de-soto",
    state: "KS",
    population: 6118,
    description:
      "De Soto is a small but growing community in western Johnson County along the Kansas River. With a population just over 6,000, it offers a rural-suburban mix with larger lot sizes and a strong sense of community. As development pushes westward from the Johnson County core, De Soto represents an emerging market for home services.",
  },
];

export function getCityBySlug(slug: string): City | undefined {
  return cities.find((c) => c.slug === slug);
}

export const JOHNSON_COUNTY_TOTAL_POPULATION = cities.reduce(
  (sum, city) => sum + city.population,
  0
);