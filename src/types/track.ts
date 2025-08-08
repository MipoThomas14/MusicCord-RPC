export interface TrackInfo {
  name: string; // name of the song
  album: string; // the album name that the song is associated with
  artist: string; // the artist for the song
  duration: number; // duration of the song in seconds
  position: number; // current progress of the song in seconds also, we'll convert it later
  state: "playing" | "paused" | "idle" | "not running";
}