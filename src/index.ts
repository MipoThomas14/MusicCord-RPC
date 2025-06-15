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


function secondsToMinutes(seconds: number): string {
  const minutes = Math.floor(seconds/60);
  const remainingSeconds = seconds % 60;
  return minutes + ":" + Math.round(remainingSeconds);
}

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



async function main(){
    try{
        await typewriter("Initializing MusicCord-RPC...\n");
        await new Promise(r => setTimeout(r, 500)); // single line timeout

        const info = await getMusicInfo();
        const songDuration = secondsToMinutes(info.position) + " / " + secondsToMinutes(info.duration); 
        const message = "Now Playing: " + info.name + " by " + info.artist + "\nStatus: " + info.state + "\n" + songDuration;
        await typewriter(message, 30);

    }catch(error){
        console.error("Error fetching info: ", error);
    }
}


main();