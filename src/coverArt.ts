import axios from "axios";

interface RecordingSearchResponse {
  recordings: { id: string; releases?: { id: string }[] }[];
}

async function fetchCoverArt(
  name: string,
  artist: string
): Promise<string | null> {
  let mbid = "";
  let artistSearchURL = new URL("https://musicbrainz.org/ws/2/recording");
  artistSearchURL.searchParams.set(
    "query",
    `recording:"${name}" AND artist:"${artist}"`
  );
  artistSearchURL.searchParams.set("fmt", "json");

  try {
    const idResult = await axios.get<RecordingSearchResponse>(
      artistSearchURL.toString(),
      {
        headers: {
          "User-Agent": "MusicCord-RPC/1.0 ( mipothomas14@gmail.com )",
        },
      }
    );
    const recs = idResult.data.recordings;
    if (!recs?.length) return null;

    const releases = recs[0].releases;
    if (!releases?.length) return null;
    mbid = releases[0].id;
  } catch (err) {
    console.warn("Cover lookup failed: ", err);
  }

  if (mbid !== "") {
    try {
      const caaUrl = `https://coverartarchive.org/release/${mbid}`;
      const caaRes = await axios.get<{
        images: Array<{
          thumbnails?: { small?: string; ["250"]?: string };
          front: boolean;
        }>;
      }>(caaUrl, {
        headers: {
          "User-Agent": "MusicCord-RPC/1.0 ( youremail@example.com )",
        },
      });

      const frontImage = caaRes.data.images.find((img) => img.front);
      const thumb =
        frontImage?.thumbnails?.small || frontImage?.thumbnails?.["250"];
      if (thumb) {
        return thumb; // e.g. https://coverartarchive.org/release/MBID/front-250
      }
    } catch (e) {
      console.warn("CAA JSON failed:", e);
    }
  }

  return null;
}

export { fetchCoverArt };