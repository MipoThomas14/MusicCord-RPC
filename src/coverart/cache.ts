import { fetchCoverArt } from "./coverart.ts";

// cooldown before retrying a lookup that failed (not a real miss)
const RETRY_AFTER_FAILURE_MS = 30_000;

interface Entry {
  url: string | null;
  retryAt?: number; // set when the lookup failed
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
  // album is in the key: same song on another album has different art
  const key = JSON.stringify([name, artist, album]);

  const hit = cache.get(key);
  if (hit && (hit.retryAt === undefined || Date.now() < hit.retryAt)) {
    return Promise.resolve(hit.url);
  }

  const running = inflight.get(key);
  if (running) return running;

  const lookup = (async () => {
    try {
      const url = await fetchCoverArt(name, artist, album, genre);
      cache.set(key, { url });
      return url;
    } catch (err) {

      cache.set(key, { url: null, retryAt: Date.now() + RETRY_AFTER_FAILURE_MS });
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
