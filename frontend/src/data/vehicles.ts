// Popular car makes and their common models (US market) for the driver sign-up flow.
export const VEHICLE_MAKES: Record<string, string[]> = {
  Acura: ["ILX", "MDX", "RDX", "TLX", "Integra"],
  Audi: ["A3", "A4", "A6", "Q3", "Q5", "Q7"],
  BMW: ["2 Series", "3 Series", "5 Series", "X1", "X3", "X5"],
  Buick: ["Enclave", "Encore", "Envision"],
  Cadillac: ["CT4", "CT5", "Escalade", "XT4", "XT5"],
  Chevrolet: ["Malibu", "Impala", "Cruze", "Equinox", "Traverse", "Tahoe", "Suburban", "Bolt EV"],
  Chrysler: ["300", "Pacifica", "Voyager"],
  Dodge: ["Charger", "Challenger", "Durango", "Grand Caravan"],
  Ford: ["Fusion", "Focus", "Escape", "Explorer", "Edge", "Expedition", "Mustang Mach-E"],
  GMC: ["Acadia", "Terrain", "Yukon"],
  Honda: ["Accord", "Civic", "CR-V", "Pilot", "HR-V", "Odyssey", "Insight"],
  Hyundai: ["Elantra", "Sonata", "Tucson", "Santa Fe", "Kona", "Ioniq 5", "Palisade"],
  Infiniti: ["Q50", "QX50", "QX60"],
  Jeep: ["Cherokee", "Grand Cherokee", "Compass", "Wrangler", "Renegade"],
  Kia: ["Forte", "Optima", "K5", "Sportage", "Sorento", "Telluride", "Niro", "Soul"],
  Lexus: ["ES", "IS", "RX", "NX", "UX"],
  Lincoln: ["Corsair", "Nautilus", "Aviator"],
  Mazda: ["Mazda3", "Mazda6", "CX-30", "CX-5", "CX-9"],
  "Mercedes-Benz": ["A-Class", "C-Class", "E-Class", "GLA", "GLC", "GLE"],
  Mitsubishi: ["Outlander", "Eclipse Cross", "Mirage"],
  Nissan: ["Altima", "Sentra", "Maxima", "Versa", "Rogue", "Murano", "Pathfinder", "Leaf"],
  Subaru: ["Impreza", "Legacy", "Outback", "Forester", "Crosstrek", "Ascent"],
  Tesla: ["Model 3", "Model Y", "Model S", "Model X"],
  Toyota: ["Corolla", "Camry", "Avalon", "Prius", "RAV4", "Highlander", "Sienna", "4Runner", "Venza"],
  Volkswagen: ["Jetta", "Passat", "Golf", "Tiguan", "Atlas", "ID.4"],
  Volvo: ["S60", "S90", "XC40", "XC60", "XC90"],
  Other: [],
};

export const MAKE_LIST = Object.keys(VEHICLE_MAKES);

// Vehicles cannot be older than 2010. Newest first.
const CURRENT_YEAR = new Date().getFullYear();
export const VEHICLE_YEARS: string[] = Array.from(
  { length: CURRENT_YEAR - 2010 + 1 },
  (_, i) => String(CURRENT_YEAR - i),
);

// ── Vehicle-class auto-categorization (mirrors backend classify_vehicle) ─────
export const VEHICLE_CLASS_INFO: Record<string, { label: string; maxPax: number; maxBags: number }> = {
  economy: { label: "Economy", maxPax: 3, maxBags: 3 },
  suv: { label: "SUV", maxPax: 4, maxBags: 4 },
  executive_suv: { label: "Executive SUV", maxPax: 6, maxBags: 6 },
};

const EXEC_KEYWORDS = [
  "suburban", "tahoe", "yukon", "escalade", "expedition", "navigator", "sequoia",
  "highlander", "pilot", "telluride", "palisade", "atlas", "traverse", "explorer",
  "pathfinder", "durango", "qx60", "qx80", "gls", "gl450", "x7", "odyssey", "sienna",
  "pacifica", "carnival", "cx-9", "cx9", "ascent", "mdx", "enclave", "acadia",
  "wagoneer", "armada", "grand caravan", "grand cherokee",
];
const SUV_KEYWORDS = [
  "escape", "cr-v", "crv", "rav4", "rav-4", "rogue", "equinox", "tucson", "santa fe",
  "sportage", "sorento", "outback", "forester", "cherokee", "compass", "edge", "blazer",
  "bronco", "4runner", "murano", "tiguan", "cx-5", "cx5", "cx-30", "cx30", "x3", "x5",
  "q5", "q7", "q3", "glc", "gle", "gla", "rdx", "venza", "kona", "seltos", "trailblazer",
  "hr-v", "hrv", "corolla cross", "nx", "rx", "ux", "gx", "lx", "crosstrek", "encore",
  "envision", "terrain", "eclipse cross", "outlander", "id.4", "ioniq 5", "mach-e",
  "xt4", "xt5", "qx50", "xc40", "xc60", "xc90", "x1", "renegade", "wrangler", "niro", "soul",
];

export function classifyVehicle(make?: string, model?: string): "economy" | "suv" | "executive_suv" {
  const text = `${make || ""} ${model || ""}`.toLowerCase();
  if (EXEC_KEYWORDS.some((k) => text.includes(k))) return "executive_suv";
  if (SUV_KEYWORDS.some((k) => text.includes(k))) return "suv";
  return "economy";
}


