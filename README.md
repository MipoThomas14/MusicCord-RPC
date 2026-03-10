# MusicCord RPC

> Display your Apple Music activity in Discord — just like Spotify does it.

MusicCord RPC connects Apple Music to Discord Rich Presence on macOS, showing your current track, artist, album art, and a live elapsed-time counter directly on your Discord profile.

---

## Preview

| Playing | Paused |
|---------|--------|
| Discord shows **"LISTENING TO"** with song name, artist, album art, and a counting-up timer | Same layout with a pause icon and no timer |

---

## Features

- 🎵 **"Listening to" display** — shows as a music activity (not a game) on your profile
- 🖼️ **Album art** — fetched from the iTunes Search API, with MusicBrainz as a fallback
- ⏱️ **Elapsed time** — live timer counting up from when the track started
- ⏸️ **Pause state** — switches to a pause icon when Apple Music is paused
- 🔗 **Apple Music link** — button on your presence that opens the song in Apple Music
- 🔄 **Auto-reconnect** — waits for Discord to open and reconnects if it closes mid-session

---

## Requirements

- macOS (AppleScript access to the Music app)
- [Node.js](https://nodejs.org) v18+
- [Discord desktop app](https://discord.com)
- A Discord application with Rich Presence enabled ([create one here](https://discord.com/developers/applications))

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/MipoThomas14/MusicCord-RPC.git
cd MusicCord-RPC
npm install
```

### 2. Create a Discord application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application** — name it `Apple Music` (this name appears on your profile)
3. Copy the **Application ID** from the General Information page
4. Go to **Rich Presence → Art Assets** and upload:
   - `applemusicrp_logo` — fallback image when no album art is found
   - `play_icon` — shown when playing
   - `pause_icon` — shown when paused

### 3. Set your Client ID

Open `src/index.ts` and replace the `clientId` value with your Application ID:

```ts
const clientId = "YOUR_APPLICATION_ID";
```

---

## Usage

**Development** (ts-node, live reload):
```bash
npm start
```

**Production** (compile first, then run):
```bash
npm run build
npm run prod
```

Keep the terminal open while you use Apple Music — close it to stop the RPC.

---

## How It Works

```
Apple Music
    │  AppleScript (every 5s)
    ▼
music.ts         → reads track name, artist, album, position, state
    │
index.ts         → diffs against last known state, skips update if nothing changed
    │
coverArt.ts      → iTunes Search API (pass 1: exact, pass 2: fuzzy strip suffixes)
    │                └─ MusicBrainz + Cover Art Archive (pass 3: fallback)
    ▼
discord-rpc      → sends SET_ACTIVITY over IPC to the Discord desktop client
```

---

## Project Structure

```
src/
├── index.ts          # Discord RPC client, polling loop, reconnection logic
├── music.ts          # AppleScript bridge to Apple Music
├── coverArt.ts       # Album art fetching (iTunes API + MusicBrainz fallback)
├── typewriter.ts     # Console typewriter animation
└── types/
    ├── track.ts                  # TrackInfo interface
    ├── applescript.d.ts          # Type stubs for the applescript package
    └── discord-rpc-extended.d.ts # Adds `type` field to discord-rpc's Presence
```

---

## Tech Stack

- [TypeScript](https://www.typescriptlang.org/)
- [discord-rpc](https://github.com/discordjs/RPC)
- [axios](https://axios-http.com/)
- [applescript](https://www.npmjs.com/package/applescript)

---

## License

ISC
