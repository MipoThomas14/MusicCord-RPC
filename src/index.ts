// imports
//import axios from 'axios';
// @ts-ignore
import { getMusicInfo } from "./music.ts";
import { typewrite } from "./typewriter.ts";
import { fetchCoverArt } from "./coverArt.ts";
import type { TrackInfo } from "./types/track.ts";

import RPC from "discord-rpc";
const client = new RPC.Client({ transport: "ipc" });
const clientId = "1383582633547792505";

let lastTrackKey = "";
let lastState: TrackInfo["state"] | null = null;
const coverArtCache = new Map<string, string | null>();

// Helper functions
function parseTrackInfo(info: TrackInfo) {
  const songDuration = secondsToMinutes(info.position) + " / " + secondsToMinutes(info.duration);
  let message = "Now playing: " + info.name + " by " + info.artist + "\n" + "Duration: " + songDuration + "\n" + "Status: " + info.state;

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

    let errorThresholdMet = false;
    if (artUrl == null && !errorThresholdMet) {
      console.warn("unable to fetch cover art for this track");
      errorThresholdMet = true;
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
