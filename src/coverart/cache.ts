import { fetchCoverArt, CoverArtIncompleteError, type StageMisses } from "./coverart.ts";

const RETRY_AFTER_FAILURE_MS = 30_000;

interface Entry {
  url: string | null;
  retryAt?: number; //  when the lookup failed
  missed?: StageMisses; // stages that already missed cleanly; a retry skips them
}

const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<string | null>>();

// remembers hits and real misses, retries failed lookups after a cooldown,
// and shares one lookup between concurrent callers
export function getCoverArt(
  name: string,
  artist: string,
  album: string,
  genre: string = ""
): Promise<string | null> {
  const key = JSON.stringify([name, artist, album]);

  const hit = cache.get(key);
  if (hit && (hit.retryAt === undefined || Date.now() < hit.retryAt)) {
    return Promise.resolve(hit.url);
  }

  const running = inflight.get(key);
  if (running) return running;

  const lookup = (async () => {
    try {
      const url = await fetchCoverArt(name, artist, album, genre, hit?.missed);
      cache.set(key, { url });
      return url;
    } catch (err) {
      // keep what we know: retry only the stage(s) that failed
      const missed = err instanceof CoverArtIncompleteError ? err.missed : hit?.missed;
      cache.set(key, { url: null, retryAt: Date.now() + RETRY_AFTER_FAILURE_MS, missed });
      console.warn(
        `Cover art lookup for "${name}" didn't finish; retrying in ${
          RETRY_AFTER_FAILURE_MS / 1000
        }s`
      );
      return null;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, lookup);
  return lookup;
}
