import * as applescript from 'applescript';
import type { TrackInfo } from "./types/track";


const applescriptString = `tell application "Music"
  if not it is running then
    return {"", "", "", "", 0, 0, "not running"}
  end if

  set s to player state
  if s is playing or s is paused then
    set t to current track
    -- position is missing value mid track-change
    set pos to 0
    try
      set pos to player position as integer
    end try
    return {name of t, album of t, artist of t, genre of t, duration of t, pos, s as string}
  else
    return {"", "", "", "", 0, 0, "idle"}
  end if
end tell`;

async function getMusicInfo(): Promise<TrackInfo> {
  return new Promise((resolve, reject) => {
    applescript.execString(
      applescriptString,
      (error: Error | null, result: any) => {
        if (error) {
          return reject(error);
        }

        const [name, album, artist, genre, dur, pos, state] = result as any[];
        const info: TrackInfo = {
          name,
          album,
          artist,
          genre: typeof genre === "string" ? genre : "",
          duration: Number(dur),
          position: Number(pos),
          state: state as TrackInfo["state"]
        };

        resolve(info);
      }
    );
  });
}

export { getMusicInfo };