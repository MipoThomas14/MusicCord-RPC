import axios from "axios";
import {
  titleKey,
  albumKey,
  artistsMatch,
  albumsMatch,
  albumsCloseMatch,
  normalize,
  errMsg,
} from "./text.ts";

// itunes pass
export interface ItunesTrack {
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  artworkUrl100: string;
}

interface ItunesSearchResponse {
  resultCount: number;
  results: ItunesTrack[];
}

export async function searchItunes(
  term: string,
  country?: string
): Promise<ItunesTrack[]> {
  let url = `https://itunes.apple.com/search?term=${encodeURIComponent(
    term
  )}&entity=song&media=music&limit=15`;
  if (country) url += `&country=${country}`;

  // console.log("itunes url: ", url);
  const res = await axios.get<ItunesSearchResponse>(url, { timeout: 10_000 });
  return res.data.results ?? [];
}



export function findItunesMatch(
  results: ItunesTrack[],
  name: string,
  artistNames: string[],
  album: string,
  loose: boolean
): ItunesTrack | undefined {
  const want = titleKey(name, loose);
  const artistOk = (r: ItunesTrack) =>
    artistNames.some((a) => artistsMatch(a, r.artistName));
  // album == title (typical for singles) says nothing about the artist
  const albumInformative = albumKey(album) !== titleKey(name, true);

  return (
    results.find(
      (r) =>
        !!r.trackName &&
        titleKey(r.trackName, loose) === want &&
        (artistOk(r) || (albumInformative && albumsMatch(album, r.collectionName)))
    ) ??
    results.find((r) => artistOk(r) && albumsCloseMatch(album, r.collectionName))
  );
}

export const hiResArt = (r: { artworkUrl100: string }) =>
  r.artworkUrl100.replace("100x100bb", "600x600bb");



export interface ItunesArtist {
  artistId: number;
  artistName: string;
  artistLinkUrl?: string;
  primaryGenreName?: string;
}

// apple generates names for non-latin letters sometimes
function slugName(url?: string): string | undefined {
  const m = url?.match(/\/artist\/([^/?]+)\//);
  if (!m) return undefined;
  let slug = m[1];
  try {
    slug = decodeURIComponent(slug);
  } catch {
    // keep the raw slug
  }
  return slug.replace(/-/g, " ");
}

function artistNamesOf(a: ItunesArtist): string[] {
  return [a.artistName, slugName(a.artistLinkUrl)].filter((n): n is string => !!n);
}

interface ItunesAlbum {
  wrapperType?: string;
  collectionName?: string;
  artworkUrl100?: string;
}

async function searchItunesArtists(
  term: string,
  country?: string
): Promise<ItunesArtist[]> {
  let url = `https://itunes.apple.com/search?term=${encodeURIComponent(
    term
  )}&entity=musicArtist&limit=25`;
  if (country) url += `&country=${country}`;

  console.log("itunes artist url: ", url);
  const res = await axios.get<{ results?: ItunesArtist[] }>(url, { timeout: 10_000 });
  return res.data.results ?? [];
}

async function lookupItunesAlbums(
  artistId: number,
  country?: string
): Promise<ItunesAlbum[]> {
  let url = `https://itunes.apple.com/lookup?id=${artistId}&entity=album&limit=200`;
  if (country) url += `&country=${country}`;

  console.log("itunes album lookup url: ", url);
  const res = await axios.get<{ results?: ItunesAlbum[] }>(url, { timeout: 10_000 });
  return (res.data.results ?? []).filter((r) => r.wrapperType === "collection");
}


function rankArtistCandidates(
  artists: ItunesArtist[],
  artist: string,
  genre: string
): ItunesArtist[] {
  const g = normalize(genre);
  const genreOk = (a: ItunesArtist) =>
    !!g && !!a.primaryGenreName && normalize(a.primaryGenreName) === g;

  return artists
    .filter((a) => artistNamesOf(a).some((n) => artistsMatch(artist, n)))
    .sort((a, b) => Number(genreOk(b)) - Number(genreOk(a)));
}

function findAlbumMatch(albums: ItunesAlbum[], album: string): ItunesAlbum | undefined {
  return (
    albums.find((a) => albumsMatch(album, a.collectionName)) ??
    albums.find((a) => albumsCloseMatch(album, a.collectionName))
  );
}

export interface ArtistRouteResult {
  url: string | null;
  hadCandidates: boolean;
}

export async function findCoverViaArtistId(
  artist: string,
  album: string,
  genre: string,
  country?: string,
  maxCandidates = 5
): Promise<ArtistRouteResult> {
  const candidates = rankArtistCandidates(
    await searchItunesArtists(artist, country),
    artist,
    genre
  ).slice(0, maxCandidates);

  console.log(
    `artist candidates (${country ?? "default"}):`,
    candidates.map((c) => `${c.artistId} ${c.artistName} [${c.primaryGenreName ?? "?"}]`)
  );

  let failure: unknown;
  let failed = false;
  for (const c of candidates) {
    try {
      const albums = await lookupItunesAlbums(c.artistId, country);
      const hit = findAlbumMatch(albums, album);
      console.log(`  artist ${c.artistId}: ${albums.length} albums${hit ? ` -> match "${hit.collectionName}"` : ""}`);

      if (hit?.artworkUrl100) {
        return { url: hiResArt({ artworkUrl100: hit.artworkUrl100 }), hadCandidates: true };
      }
    } catch (err) {
      failed = true;
      failure = err;
      console.warn(`album lookup for artist ${c.artistId} failed:`, errMsg(err));
    }
  }
  if (failed) throw failure;
  console.log(`  no album matching "${album}" under ${candidates.length} candidate artist(s)`);
  return { url: null, hadCandidates: candidates.length > 0 };
}