import axios from "axios";

interface ItunesSearchResponse {
  resultCount: number;
  results: Array<{
    trackName: string;
    artistName: string;
    collectionName: string;
    artworkUrl100: string;
  }>;
}

function stripSuffixes(s: string): string {
  return s.replace(/\s*[\(\[].+?[\)\]]/g, "").trim();
}

async function fetchCoverArtFromItunes(
  name: string,
  artist: string
): Promise<string | null> {
  const query = encodeURIComponent(`${artist} ${name}`);
  const url = `https://itunes.apple.com/search?term=${query}&entity=song&media=music&limit=5`;

  const res = await axios.get<ItunesSearchResponse>(url);
  const results = res.data.results;
  if (!results?.length) return null;

  const nameLower = name.toLowerCase();
  const artistLower = artist.toLowerCase();

  const best = results.map((r) => ({
      r,
      score:
        (r.trackName.toLowerCase().includes(nameLower) ? 1 : 0) +
        (r.artistName.toLowerCase().includes(artistLower) ? 1 : 0),
    })).sort((a, b) => b.score - a.score)[0];

  if (best.score === 0) return null;

  return best.r.artworkUrl100.replace("100x100bb", "600x600bb");
}

interface RecordingSearchResponse {
  recordings: { id: string; releases?: { id: string }[] }[];
}

const MB_USER_AGENT = "MusicCord-RPC/1.0 ( mipothomas14@gmail.com )";

async function fetchCoverArtFromMusicBrainz(
  name: string,
  artist: string
): Promise<string | null> {
  let mbid = "";

  const artistSearchURL = new URL("https://musicbrainz.org/ws/2/recording");
  artistSearchURL.searchParams.set(
    "query",
    `recording:"${name}" AND artist:"${artist}"`
  );
  artistSearchURL.searchParams.set("fmt", "json");

  try {
    const idResult = await axios.get<RecordingSearchResponse>(
      artistSearchURL.toString(),
      { headers: { "User-Agent": MB_USER_AGENT } }
    );
    const recs = idResult.data.recordings;
    if (!recs?.length) return null;

    const releases = recs[0].releases;
    if (!releases?.length) return null;
    mbid = releases[0].id;
  } catch (err) {
    return null;
  }

  if (!mbid) return null;

  try {
    const caaUrl = `https://coverartarchive.org/release/${mbid}`;
    const caaRes = await axios.get<{
      images: Array<{
        thumbnails?: { small?: string; ["250"]?: string };
        front: boolean;
      }>;
    }>(caaUrl, { headers: { "User-Agent": MB_USER_AGENT } });

    const frontImage = caaRes.data.images.find((img) => img.front);
    const thumb =
      frontImage?.thumbnails?.small || frontImage?.thumbnails?.["250"];
    return thumb ?? null;
  } catch (e) {
    return null;
  }
}


export async function fetchCoverArt(
  name: string,
  artist: string
): Promise<string | null> {
  try { // iTunes pass 1
    const result = await fetchCoverArtFromItunes(name, artist);
    if (result) return result;
  } catch (err) {
    console.warn("iTunes pass 1 failed:", err);
  }

  const cleanName = stripSuffixes(name);
  const cleanArtist = stripSuffixes(artist);
  if (cleanName !== name || cleanArtist !== artist) {
    try { // iTunes pass 2
      const result = await fetchCoverArtFromItunes(cleanName, cleanArtist);
      if (result) return result;
    } catch (err) {
      console.warn("iTunes pass 2 failed:", err);
    }
  }

  try { // MusicBrainz pass 3
    return await fetchCoverArtFromMusicBrainz(name, artist);
  } catch (err) {
    console.warn("MusicBrainz cover lookup failed:", err);
    return null;
  }
}
