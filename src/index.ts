// imports
const { typewriterF: typewriter } = require("./typewriter");
const applescript = require("applescript");

interface TrackInfo{
    name: string,
    artist: string,
    duration: number, // in seconds
    position: number, // in seconds also, we'll convert it later
    state: "playing" | "paused" | "stopped"
}

const applescriptString = `
    tell application "Music"
    set s to player state
    if s is playing or s is paused then
        set t to current track
        return {name of t, artist of t, duration of t, player position as integer, s as string}
    else
        return {"", "", 0, 0, "stopped"}
    end if
    end tell`;



async function getMusicInfo(): Promise<TrackInfo> {
  return new Promise((resolve, reject) => {
    applescript.execString(applescriptString, (error: Error | null, result: any) => {
      if (error) {
        return reject(error);
      }

      const [name, artist, dur, pos, state] = result as any[];
      const info: TrackInfo = {
        name,
        artist,
        duration: Number(dur),
        position: Number(pos),
        state: state as TrackInfo["state"] || null
      };
      resolve(info);
    });
  });
}



typewriter("Initializing MusicCord-RPC...");

