import { normalize } from "./text.ts";

// Genre -> other iTunes storefronts (ISO country codes) to try when the default
// - Genre names based on apples
// itunes.apple.com/WebObjects/MZStoreServices.woa/ws/genres?id=34


interface Region {
  genres?: string[];
  prefixes?: string[];
  storefronts: string[];
}

const REGIONS: Region[] = [
  {
    genres: ["J-Pop", "Japanese Pop", "Japan", "Anime", "Enka", "Kayokyoku"],
    storefronts: ["JP"],
  },
  {
    genres: ["Mandopop", "C-Pop", "Taiwanese Folk"],
    prefixes: ["Chinese"],
    storefronts: ["TW", "HK"],
  },
  { genres: ["Cantopop/HK-Pop"], storefronts: ["HK", "TW"] },
  {
    genres: [
      "Bollywood", "Indian", "Indian Pop", "Indian Folk", "Regional Indian",
      "Punjabi", "Punjabi Pop", "Tamil", "Telugu", "Kannada", "Malayalam",
      "Marathi", "Gujarati", "Bengali", "Bhojpuri", "Haryanvi", "Odia",
      "Assamese", "Rajasthani", "Rabindra Sangeet", "Ghazals",
    ],
    storefronts: ["IN"],
  },
  {
    genres: [
      "Brazilian", "MPB", "Sertanejo", "Samba", "Pagode", "Forró", "Choro",
      "Axé", "Baile Funk", "Bossa Nova", "Frevo",
    ],
    storefronts: ["BR"],
  },
  {
    genres: [
      "Música Mexicana", "Tex-Mex", "Latin", "Contemporary Latin", "Pop Latino",
      "Urbano latino", "Baladas y Boleros", "Música tropical",
      "Rock y Alternativo", "Latin Rap",
    ],
    storefronts: ["MX", "ES"],
  },
  { genres: ["Flamenco", "Iberia"], storefronts: ["ES"] },
  { genres: ["French Pop", "Chanson", "France"], storefronts: ["FR"] },
  {
    genres: ["German Pop", "German Folk", "Deutschpop", "Deutschrap"],
    storefronts: ["DE"],
  },
  {
    genres: ["Fantezi", "Arabesque", "Halk", "Sanat", "Özgün"],
    prefixes: ["Turkish"],
    storefronts: ["TR"],
  },
  { genres: ["Thai Pop", "Thai Country", "T-Pop"], storefronts: ["TH"] },
  { genres: ["Indo Pop", "Dangdut", "Indonesian Religious"], storefronts: ["ID"] },
  {
    genres: ["Pinoy Pop", "Original Pilipino Music", "Manilla Sound"],
    storefronts: ["PH"],
  },
  {
    genres: [
      "Russian", "Pop in Russian", "Rock in Russian", "Hip-Hop in Russian",
      "Chanson in Russian", "Bard in Russian", "Romance in Russian",
    ],
    storefronts: ["RU"],
  },
  {
    genres: ["Arabic", "Arabic Pop"],
    prefixes: ["Khaleeji"],
    storefronts: ["SA", "EG"],
  },
  { genres: ["Electro-Cha'abi"], prefixes: ["Egyptian"], storefronts: ["EG"] },
  {
    genres: [
      "Afrikaans", "South African Hip-Hop", "Amapiano", "Gqom", "Kwaito",
      "Maskandi", "South Africa",
    ],
    storefronts: ["ZA"],
  },
  {
    genres: ["Afrobeats", "Afro-Beat", "Afro-Pop", "Afro-fusion", "Highlife", "Fuji"],
    storefronts: ["NG"],
  },
];

// max extra storefronts per track
export const MAX_EXTRA_STOREFRONTS = 2;

export function storefrontsForGenre(genre: string): string[] {
  const g = normalize(genre);
  if (!g) return [];

  const out: string[] = [];
  for (const r of REGIONS) {
    const hit =
      r.genres?.some((x) => normalize(x) === g) ||
      r.prefixes?.some((p) => g.startsWith(normalize(p)));
    if (hit) for (const s of r.storefronts) if (!out.includes(s)) out.push(s);
  }
  return out.slice(0, MAX_EXTRA_STOREFRONTS);
}
