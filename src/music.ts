import * as applescript from 'applescript';
import type { TrackInfo } from "./types/track";

const applescriptString = `tell application "Music"
  if not it is running then
    return {"", "", "", 0, 0, "not running"}
  end if

  set s to player state
  if s is playing or s is paused then
    set t to current track
    return {name of t, album of t, artist of t, duration of t, player position as integer, s as string}
  else
    return {"", "", "", 0, 0, "idle"}
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

        const [name, album, artist, dur, pos, state] = result as any[];
        const info: TrackInfo = {
          name,
          album,
          artist,
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