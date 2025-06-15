function welcomeFunc(): Promise<void> {
  return new Promise(async (resolve) => {
    const message = "Initializing MusicCord-RPC...";
    for (const char of message) {
      process.stdout.write(char);
      await new Promise(r => setTimeout(r, 75));
    }
    process.stdout.write("\n");
    resolve();
  });
}

// CommonJS export:
module.exports = { welcomeFunc };
