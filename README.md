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
