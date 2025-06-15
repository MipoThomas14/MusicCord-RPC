function wait(ms: number): any{
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main(){
    const welcomeMessage = "Initializing MusicCord-RPC...";
    const welcomeMessageArray = welcomeMessage.split("");
    for(let i = 0; i < welcomeMessageArray.length; i++){
        process.stdout.write(welcomeMessageArray[i]);
        await wait(50);
    }
    await wait(500);
    console.log("");
}

main(); // typewriter nonsense