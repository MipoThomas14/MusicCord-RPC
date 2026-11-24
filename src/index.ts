// imports
import RPC from "discord-rpc";

import dotenv from 'dotenv/config';
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
if(!CLIENT_ID){
  console.error("Error: DISCORD_CLIENT_ID is not set in .env. Please create a new .env file and see README for instructions.");
  process.exit(1); 
}

import { getMusicInfo } from "./music.ts";
import { typewrite } from "./typewriter.ts";
import { fetchCoverArt } from "./coverart.ts";
import type { TrackInfo } from "./types/track.ts";

const RETRY_MS = 15_000;
// the guard above narrows CLIENT_ID, but TS drops that inside hoisted functions like connect()
const clientId: string = CLIENT_ID;

let isWaiting = false;
let client: RPC.Client | null = null;
let pollInterval: NodeJS.Timeout | null = null;

let lastTrackKey: string;
let lastState: TrackInfo["state"] | null = null;
const coverArtCache = new Map<string, string | null>();


function buildSongShareURL(name: string, artist: string): string {
  const term = encodeURIComponent(`${artist} ${name}`);
  return `https://music.apple.com/${'us'}/search?term=${term}`;
}



// Connection management

function scheduleReconnect() {
  if (!isWaiting) {
    isWaiting = true;
    console.log(`Waiting for Discord... (retrying every ${RETRY_MS / 1000}s)`);
  }
  setTimeout(connect, RETRY_MS);
}

function connect() {
  // Cancel any leftover poll loop from a previous connection
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }

  client = new RPC.Client({ transport: "ipc" });

  client.on("ready", () => {
    isWaiting = false;
    console.log("Discord RPC connected");
    startRPC();
  });

  client.on("disconnected", () => {
    console.warn("Discord disconnected — waiting to reconnect...");
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    isWaiting = false;
    scheduleReconnect();
  });

  client.login({ clientId }).catch(() => scheduleReconnect());
}

// Main loop
async function startRPC() {
  await new Promise((r) => setTimeout(r, 30));
  await typewrite("Starting RPC Loop... \n\n", 15);

  let lastTrack: string;

  pollInterval = setInterval(async () => {
    let info: TrackInfo;
    try {
      info = await getMusicInfo();
    } catch (err) {
      // don't kill the entire process and therefore musiccord for a possible blip
      console.warn("Couldn't read Music, skipping this poll:", err instanceof Error ? err.message : err);
      return;
    }

    if(!lastTrack || lastTrack != info.name){
      lastTrack = info.name;

      const newTrackLine = "New track: " + info.name + " - " + info.artist + " | " + info.state;
      await typewrite(newTrackLine, 10);
    }


    let trackKey = `${info.name}-${info.artist}`;

    // Clear presence immediately when Apple Music isn't actively in use
    if (info.state === "not running" || info.state === "idle") {
      if (lastState !== info.state) {
        lastState = info.state;
        client!.clearActivity();
      }
      return;
    }

    // fetch and set coverrart
    let artUrl: string | null;
    if (coverArtCache.has(trackKey)) {
      artUrl = coverArtCache.get(trackKey)!;
    } else {
      artUrl = await fetchCoverArt(info.name, info.artist);
      coverArtCache.set(trackKey, artUrl);
    }

    if (artUrl == null) { // this should literally never happen
      console.warn(`No cover art found for: ${info.name} - ${info.artist}`);
    }


    if (trackKey !== lastTrackKey || lastState !== info.state) {
      lastTrackKey = trackKey;
      lastState = info.state;

      const isPlaying = info.state === "playing";

      (client as any).request("SET_ACTIVITY", {
        pid: process.pid,
        activity: {
          type: 2,
          details: info.name,
          state: info.artist,
          assets: {
            large_image: artUrl ?? "applemusicrp_logo",
            large_text: info.album,
            small_image: isPlaying ? "play_icon" : "pause_icon",
            small_text: isPlaying ? "Playing" : "Paused",
          },
          ...(isPlaying && {
            timestamps: {
              start: Math.round((Date.now() - info.position * 1000) / 1000),
            },
          }),
          buttons: [
            { label: "Open in Apple Music", url: buildSongShareURL(info.name, info.artist) },
          ],
        },
      });
    }
  }, 5_000);
}

connect();
