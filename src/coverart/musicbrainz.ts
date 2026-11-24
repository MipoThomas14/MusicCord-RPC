import axios from "axios";
import {
  titleKey,
  artistsMatch,
  albumsMatch,
  isNonLatin,
  sleep,
  errMsg,
} from "./text.ts";

// musicBrainzpass
const getMbUserAgent = () => process.env.USER_AGENT || "MusicCord-RPC/1.0";
const MB_MIN_INTERVAL_MS = 1100; // MusicBrainz allows ~1 request/second

interface MbAlias {
  name?: string;
  "sort-name"?: string;
}

interface MbCredit {
  name: string;
  artist: {
    name: string;
    "sort-name"?: string;
    aliases?: MbAlias[];
  };
}

interface MbRecording {
  title: string;
  "artist-credit"?: MbCredit[];
  releases?: { id: string; title: string; country?: string }[];
}

interface RecordingSearchResponse {
  recordings?: MbRecording[];
}

interface MbArtist {
  id: string;
  name: string;
  "sort-name"?: string;
  country?: string;
  score?: number;
  aliases?: MbAlias[];
}

interface ArtistSearchResponse {
  artists?: MbArtist[];
}


let mbChain: Promise<unknown> = Promise.resolve();
let mbLastRequestAt = 0;

function mbGet<T>(url: string): Promise<T> {
  const task = async (): Promise<T> => {
    for (let attempt = 0; ; attempt++) {
      const wait = mbLastRequestAt + MB_MIN_INTERVAL_MS - Date.now();

      if (wait > 0) await sleep(wait);
      mbLastRequestAt = Date.now();
      try {

        const res = await axios.get<T>(url, {
          headers: { "User-Agent": getMbUserAgent() },
          timeout: 10_000,
        });

        return res.data;
      } catch (err) { // error handling for musicbrainz 503
        const busy = axios.isAxiosError(err) && err.response?.status === 503;

        if (!busy || attempt >= 1) throw err;
        console.warn("MusicBrainz is busy, retrying once...");
        await sleep(2000);
      }
    }
  };

  const result = mbChain.then(task);
  mbChain = result.catch(() => undefined);
  return result;
}


const escapePhrase = (s: string) => s.replace(/["\\]/g, "\\$&");


function recordingSearchUrl(query: string, limit: number): string {
  const u = new URL("https://musicbrainz.org/ws/2/recording");
  u.searchParams.set("query", query);
  u.searchParams.set("limit", String(limit));
  u.searchParams.set("fmt", "json");
  return u.toString();
}

// every name this credit is known by
function creditNames(c: MbCredit): string[] {
  const names = [c.name, c.artist?.name, c.artist?.["sort-name"]];
  for (const a of c.artist?.aliases ?? []) names.push(a.name, a["sort-name"]);
  return names.filter((n): n is string => !!n);
}


export interface MbMatch {
  scriptNames: string[]; // for storefront choice
  artistNames: string[]; // for artist matching
  releaseIds: string[]; // album-matching first
  releaseCountries: string[]; // most common first
  incomplete: boolean; // a request failed along the way
}

function pickMusicBrainzMatch(
  recs: MbRecording[],
  name: string,
  artist: string,
  album: string,
  loose: boolean
): Omit<MbMatch, "incomplete"> | null {
  const want = titleKey(name, loose);
  const candidates: { rec: MbRecording; credit: MbCredit }[] = [];

  for (const rec of recs) {
    if (!rec.releases?.length) continue;
    if (titleKey(rec.title, loose) !== want) continue;
    const credit = rec["artist-credit"]?.find((c) =>
      creditNames(c).some((n) => artistsMatch(artist, n))
    );
    if (credit) candidates.push({ rec, credit });
  }
  if (!candidates.length) return null;

  const best =
    candidates.find((c) =>
      c.rec.releases!.some((r) => albumsMatch(album, r.title))
    ) ?? candidates[0];

  const releases = [...best.rec.releases!].sort(
    (a, b) =>
      Number(albumsMatch(album, b.title)) - Number(albumsMatch(album, a.title))
  );

  const counts = new Map<string, number>();
  for (const r of releases) {
    if (r.country) counts.set(r.country, (counts.get(r.country) ?? 0) + 1);
  }

  return {
    scriptNames: [best.credit.name, best.credit.artist?.name].filter(Boolean),
    artistNames: creditNames(best.credit),
    releaseIds: releases.map((r) => r.id),
    releaseCountries: [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([country]) => country),
  };
}

function artistSearchUrl(artist: string): string {
  const a = escapePhrase(artist);
  const u = new URL("https://musicbrainz.org/ws/2/artist");
  u.searchParams.set(
    "query",
    `artist:"${a}" OR alias:"${a}" OR sortname:"${a}"`
  );
  u.searchParams.set("limit", "25");
  u.searchParams.set("fmt", "json");
  return u.toString();
}

function artistNamesOf(a: MbArtist): string[] {
  const names = [a.name, a["sort-name"]];
  for (const al of a.aliases ?? []) names.push(al.name, al["sort-name"]);
  return names.filter((n): n is string => !!n);
}

const MAX_ARTIST_CANDIDATES = 8;

// artists matching yours, best score first
function pickArtistCandidates(artists: MbArtist[], artist: string): MbArtist[] {
  return artists
    .filter((a) => artistNamesOf(a).some((n) => artistsMatch(artist, n)))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, MAX_ARTIST_CANDIDATES);
}

// artist known, recording not: enough to search their storefront by name
function identityOnlyMatch(
  candidates: MbArtist[],
  incomplete: boolean
): MbMatch | null {
  const c = candidates.find((a) => isNonLatin(a.name));
  if (!c) return null;
  return {
    scriptNames: [c.name],
    artistNames: artistNamesOf(c),
    releaseIds: [],
    releaseCountries: c.country ? [c.country] : [],
    incomplete,
  };
}



// Returns null only for a definitive miss.
export async function resolveWithMusicBrainz(
  name: string,
  artist: string,
  album: string,
  loose: boolean
): Promise<MbMatch | null> {
  const state = { failed: false, error: undefined as unknown };
  const query = async <T>(url: string): Promise<T | null> => {
    try {
      // console.log("musicbrainz url: ", url);
      return await mbGet<T>(url);
    } catch (err) {
      state.failed = true;
      state.error = err;
      // console.warn("MusicBrainz request failed:", errMsg(err));
      return null;
    }
  };
  const find = (data: RecordingSearchResponse | null) =>
    data
      ? pickMusicBrainzMatch(data.recordings ?? [], name, artist, album, loose)
      : null;

  const t = escapePhrase(name);

  const first = find(
    await query<RecordingSearchResponse>(
      recordingSearchUrl(`recording:"${t}" AND artist:"${escapePhrase(artist)}"`, 25)
    )
  );
  if (first) return { ...first, incomplete: state.failed };

  const found = await query<ArtistSearchResponse>(artistSearchUrl(artist));
  const candidates = pickArtistCandidates(found?.artists ?? [], artist);

  if (candidates.length) {
    const arids = candidates.map((c) => `arid:${c.id}`).join(" OR ");
    const second = find(
      await query<RecordingSearchResponse>(
        recordingSearchUrl(`recording:"${t}" AND (${arids})`, 25)
      )
    );
    if (second) return { ...second, incomplete: state.failed };

    const identity = identityOnlyMatch(candidates, state.failed);
    if (identity) return identity;
  }

  if (state.failed) throw state.error;
  return null;
}

// non-Latin credited name -> try that storefront
export function pickStorefronts(match: MbMatch): string[] {
  if (!match.scriptNames.some(isNonLatin)) return [];

  const joined = match.scriptNames.join(" ");
  if (/[\u3040-\u30ff]/.test(joined)) return ["JP"]; // kana
  if (/[\uac00-\ud7af\u1100-\u11ff]/.test(joined)) return ["KR"]; // hangul

  const fromReleases = match.releaseCountries
    .filter((c) => /^[A-Z]{2}$/.test(c) && c !== "US" && c !== "XW" && c !== "XE")
    .slice(0, 2);
  if (fromReleases.length) return fromReleases;

  return /[\u4e00-\u9fff]/.test(joined) ? ["TW", "CN"] : []; // Han only
}

// null = no art; throws if a request failed (other than 404)
export async function fetchFromCoverArtArchive(
  releaseIds: string[]
): Promise<string | null> {
  let failed = false;
  let lastError: unknown;
  for (const id of releaseIds.slice(0, 3)) {
    try {
      const caaUrl = `https://coverartarchive.org/release/${id}`;
      // console.log(`caa url: ${caaUrl}`);
      const caaRes = await axios.get<{
        images: Array<{
          thumbnails?: { small?: string; ["250"]?: string };
          front: boolean;
        }>;
      }>(caaUrl, {
        headers: { "User-Agent": getMbUserAgent() },
        timeout: 10_000,
      });

      const frontImage = caaRes.data.images.find((img) => img.front);
      const thumb =
        frontImage?.thumbnails?.small || frontImage?.thumbnails?.["250"];
      if (thumb) return thumb;
    } catch (err) {
      // 404: no art for this release
      if (!(axios.isAxiosError(err) && err.response?.status === 404)) {
        failed = true;
        lastError = err;
      }
    }
  }
  if (failed) throw lastError;
  return null;
}
