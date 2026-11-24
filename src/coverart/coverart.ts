import {
  searchItunes,
  findItunesMatch,
  hiResArt,
  findCoverViaArtistId,
} from "./itunes.ts";
import { storefrontsForGenre } from "./storefronts.ts";
import {
  resolveWithMusicBrainz,
  // pickStorefronts,
  fetchFromCoverArtArchive,
  type MbMatch,
} from "./musicbrainz.ts";
import { stripSuffixes, isNonLatin, errMsg, primaryArtist } from "./text.ts";

// stages that already ended in a definitive miss, so a retry can skip them
export interface StageMisses {
  itunes?: boolean;
  musicbrainz?: boolean; // MusicBrainz + Cover Art Archive
}



// thrown when no cover was found and at least 1 lookup was failed.
// doesn't count as a definitive miss. just means retry later
export class CoverArtIncompleteError extends Error {
  missed: StageMisses;
  constructor(missed: StageMisses = {}) {
    super("cover art lookup incomplete: a request failed");
    this.name = "CoverArtIncompleteError";
    this.missed = missed;
  }
}


// main function to fetch coverart, utilizes 5 different passes for resilience
export async function fetchCoverArt(name: string, artist: string, album: string, genre: string = "", prior: StageMisses = {}): Promise<string | null> {
  // a stage that ran without a failed request and found nothing is a definitive miss
  let itunesFailed = false;
  let mbFailed = false;
  const miss = (): null => {
    if (itunesFailed || mbFailed) {
      throw new CoverArtIncompleteError({ itunes: !itunesFailed, musicbrainz: !mbFailed });
    }
    return null;
  };



  const cleanName = stripSuffixes(name);
  const cleanArtist = stripSuffixes(artist);

  const variants = [{ name, artist, loose: false }];
  if (cleanName !== name || cleanArtist !== artist) {
    variants.push({ name: cleanName, artist: cleanArtist, loose: true });
  }


  // Pass 1: first iTunes pass, second pass if stripped suffix necessary
  for (const [i, v] of variants.entries()) {
    if (prior.itunes) break; // missed cleanly on an earlier attempt; only retry what failed
    console.log("testing variant ", variants[i]);
    try {
      const results = await searchItunes(`${v.artist} ${v.name}`);
      const hit = findItunesMatch(results, v.name, [v.artist], album, v.loose);
      if (hit){
        console.log("success on first iTunes pass");
        return hiResArt(hit);
      }
    } catch (err) {
      itunesFailed = true;
      console.warn(`iTunes pass ${i + 1} failed:`, errMsg(err));
    }
  }


  // Pass 2: iTunes artist-ID route; genre ranks candidates and picks extra storefronts
  const artistTerms = [...new Set([artist, cleanArtist, primaryArtist(artist)])].filter(Boolean);
  const storefronts: (string | undefined)[] = [undefined, ...storefrontsForGenre(genre)];
  for (const country of storefronts) {
    if (prior.itunes) break;
    for (const term of artistTerms) {
      try {
        const route = await findCoverViaArtistId(term, album, genre, country, country ? 3 : 5);
        if (route.url) {
          console.log(`success on artist-ID pass (${country ?? "default"} storefront)`);
          return route.url;
        }
        if (route.hadCandidates) break; // artist found, album isn't in this storefront
      } catch (err) {
        itunesFailed = true;
        console.warn(`artist-ID pass failed (${country ?? "default"} storefront):`, errMsg(err));
      }
    }
  }


  // Pass 3: resolve the artist/track on MusicBrainz (credited name, releases)
  let match: MbMatch | null = null;
  let matchedVariant = variants[0];
  for (const v of variants) {
    if (prior.musicbrainz) break;
    try {
      match = await resolveWithMusicBrainz(v.name, v.artist, album, v.loose);
    } catch (err) {
      mbFailed = true;
      console.warn("MusicBrainz pass failed:", errMsg(err));
      continue;
    }
    if (match) {
      console.log("success on first musicbrainz pass")
      matchedVariant = v;
      break;
    }
  }

  if (!match) return miss();
  if (match.incomplete) mbFailed = true;



  // Pass 4: Cover Art Archive, using the releases MusicBrainz already gave us
  try {
    const art = await fetchFromCoverArtArchive(match.releaseIds);
    if (art) {
      console.log("coverart pass success");
      return art;
    }
  } catch (err) {
    mbFailed = true;
    console.warn("Cover Art Archive pass failed:", errMsg(err));
  }
  return miss();
}
