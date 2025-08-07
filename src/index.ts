// imports
//import axios from 'axios';
// @ts-ignore
const applescript = await import("applescript");
import { typewrite } from "./typewriter.ts";
import { fetchCoverArt } from "./apiClient.ts";

import RPC from "discord-rpc";
const client = new RPC.Client({ transport: "ipc" });
const clientId = "1383582633547792505";

let lastTrackKey = "";
let lastState: TrackInfo["state"] | null = null;
const coverArtCache = new Map<string, string | null>();

// Helper functions
interface TrackInfo {
  // todo: add album (string) to this interface
  name: string;
  artist: string;
  duration: number; // in seconds
  position: number; // in seconds also, we'll convert it later
  state: "playing" | "paused" | "idle" | "not running";
}

function parseTrackInfo(info: TrackInfo) {
  let message = "";
  const songDuration =
    secondsToMinutes(info.position) + " / " + secondsToMinutes(info.duration);
  message += "Now playing: " + info.name + " by " + info.artist + "\n";
  message += "Duration: " + songDuration + "\n";
  message += "Status: " + info.state;

  if (info.state == "not running") {
    return "Apple music not currently running.";
  } else if (info.state == "idle") {
    return "Currently Idling!";
  }

  return message;
}

function secondsToMinutes(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes + ":" + Math.round(remainingSeconds);
}

// Data Queries
const applescriptString = `tell application "Music"
  if not it is running then
    return {"", "", 0, 0, "not running"}
  end if

  set s to player state
  if s is playing or s is paused then
    set t to current track
    return {name of t, artist of t, duration of t, player position as integer, s as string}
  else
    return {"", "", 0, 0, "idle"}
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

        const [name, artist, dur, pos, state] = result as any[];
        const info: TrackInfo = {
          name,
          artist,
          duration: Number(dur),
          position: Number(pos),
          state: (state as TrackInfo["state"]) || null,
        };
        resolve(info);
      }
    );
  });
}

// Main loop
async function startRPC() {
  await new Promise((r) => setTimeout(r, 60));
  await typewrite("Starting RPC Loop... \n\n", 25);

  setInterval(async () => {
    console.time('AppleScript');  
    const info = await getMusicInfo();
    console.timeEnd('AppleScript');  

    const newTrackLine =
      "Got a track! " +
      " " +
      info.name +
      " - " +
      info.artist +
      " | " +
      info.state;
    await typewrite(newTrackLine, 20);

    let trackKey = `${info.name}-${info.artist}`;

    let artUrl: string | null;
    if (coverArtCache.has(trackKey)) {
      artUrl = coverArtCache.get(trackKey)!;
    } else {
      artUrl = await fetchCoverArt(info.name, info.artist);
      coverArtCache.set(trackKey, artUrl);
    }

    if (trackKey !== lastTrackKey || lastState != info.state) {
      lastTrackKey = trackKey;
      lastState = info.state;

      client.setActivity({
        details:
          info.state === "playing" || info.state === "paused"
            ? "Listening to " + info.name
            : "Not listening",
        state: info.state === "playing" ? `by ${info.artist}` : undefined,
        largeImageKey: artUrl ?? "applemusicrp_logo",
        startTimestamp: Date.now() - info.position * 1000,
        smallImageText: info.state,
        smallImageKey: info.state === "playing" ? "play_icon" : "pause_icon",
      });
    }
  }, 10_000);
}

client.on("ready", () => {
  console.log("✅ Discord RPC connected");
  startRPC();
});

client.login({ clientId }).catch((err) => {
  console.error("❌ RPC login failed:", err);
  process.exit(1);
});
