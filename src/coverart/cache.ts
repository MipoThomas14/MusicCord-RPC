import { fetchCoverArt, CoverArtIncompleteError, type StageMisses } from "./coverart.ts";

const BASE_RETRY_MS = 60_000;
const MAX_RETRIES = 3;
const JITTER = 0.25; // +-25% jitter
const backoffMs = (retry: number) => BASE_RETRY_MS * 2 ** retry * (1 + (Math.random() * 2 - 1) * JITTER);

interface Entry {
  url: string | null;
  retryAt?: number; //  when the lookup failed
  failures?: number; // failed attempts so far
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
      const failures = (hit?.failures ?? 0) + 1;

      if (failures > MAX_RETRIES) { // recorded in cache as a hard miss
        cache.set(key, { url: null });
        return null;
      }

      const delay = backoffMs(failures - 1);
      cache.set(key, { url: null, retryAt: Date.now() + delay, failures, missed });
      return null;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, lookup);
  return lookup;
}
