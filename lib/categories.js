export const CATEGORIES = [
  {
    slug: "ai",
    label: "AI",
    searchTerms: ["artificial intelligence", "AI", "machine learning", "generative AI"],
  },
  {
    slug: "energy",
    label: "Energy",
    searchTerms: ["energy", "renewable energy", "energy transition", "clean power"],
  },
  {
    slug: "data-center",
    label: "Data Center",
    searchTerms: ["data center", "data centers", "cloud infrastructure", "data center industry"],
  },
  {
    slug: "africa-economy-finance",
    label: "Africa Economy & Finance",
    searchTerms: ["African economy", "Africa business", "African markets", "Africa finance"],
  },
  {
    slug: "ghana",
    label: "Ghana",
    searchTerms: ["Ghana", "Ghana business", "Ghana economy", "Ghana news"],
  },
];

export function getCategory(slug) {
  return CATEGORIES.find((c) => c.slug === slug) || null;
}
