// normalization helpers
export function stripSuffixes(s: string): string {
  return s.replace(/\s*[\(\[].+?[\)\]]/g, "").trim();
}

export function normalize(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // combining accents
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, " ")
    .trim();
}

// re-release markers: "Song - 2011 Remaster", "Song (Remastered)"
const EDITION =
  /\b(?:remaster(?:ed)?|mono|stereo|(?:single|album|original|radio|explicit|clean|deluxe|expanded|anniversary)\s+(?:version|edition|mix)|radio edit|bonus track)\b/i;

export function stripEditionMarkers(s: string): string {
  return s
    .replace(/\s*[\(\[][^\)\]]*[\)\]]/g, (m) => (EDITION.test(m) ? "" : m))
    .replace(/\s+[-–—]\s+([^-–—]+)$/, (m, tail: string) =>
      EDITION.test(tail) ? "" : m
    )
    .trim();
}

// loose also drops every (...) / [...] suffix
export function titleKey(s: string, loose: boolean): string {
  return normalize(stripEditionMarkers(loose ? stripSuffixes(s) : s));
}

export function albumKey(s: string): string {
  return normalize(
    stripSuffixes(stripEditionMarkers(s.replace(/\s*-\s*(single|ep)\s*$/i, "")))
  );
}

export function tokenKey(s: string): string {
  return normalize(s)
    .split(" ")
    .filter((t) => t && t !== "the")
    .sort()
    .join(" ");
}



// logic helpers
export function albumsMatch(a: string, b: string | undefined): boolean {
  if (!b) return false;
  const ka = albumKey(a);
  return ka !== "" && ka === albumKey(b);
}

// "Variety" ~ "VARIETY -30th Anniversary Edition-", but not "Greatest Hits Vol. 2"
const ALBUM_EDITION_WORDS =
  /\b(?:edition|deluxe|expanded|remaster(?:ed)?|anniversary|version|reissue|bonus|special|collector|original)\b/;

export function albumsCloseMatch(a: string, b: string | undefined): boolean {
  if (!b) return false;
  const ka = albumKey(a);
  const kb = albumKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;

  const [short, long] = ka.length <= kb.length ? [ka, kb] : [kb, ka];
  return (
    short.length >= 4 &&
    long.startsWith(short + " ") &&
    ALBUM_EDITION_WORDS.test(long.slice(short.length))
  );
}

export function artistsMatch(a: string, b: string | undefined): boolean {
  if (!b) return false;
  const ka = artistKeys(a);
  for (const k of artistKeys(b)) if (ka.has(k)) return true;
  return false;
}

export function isNonLatin(s: string): boolean {
  return [...s].some(
    (ch) => /\p{L}/u.test(ch) && !/\p{Script=Latin}/u.test(ch)
  );
}


// other
const ARTIST_SPLIT = /\s*(?:,|&|;|\/|\bfeat\.?|\bft\.?|\bfeaturing\b|\bwith\b|\band\b|\bx\b)\s*/i;

export function artistKeys(s: string): Set<string> {
  const keys = new Set<string>();
  for (const part of [s, ...s.split(ARTIST_SPLIT)]) {
    const k = tokenKey(part);
    if (k) keys.add(k);
  }
  return keys;
}

// "A feat. B" -> "A"
export function primaryArtist(s: string): string {
  return s.split(ARTIST_SPLIT)[0].trim() || s;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
