
async function typewrite(message: string, speed: number | null): Promise<void> {
    if (speed == null) {
      speed = 50;
    }

    return new Promise(async (resolve) => {
    for (const char of message) {
      process.stdout.write(char);
      await new Promise(r => setTimeout(r, speed));
    }
    process.stdout.write("\n");
    resolve();
  });
}


export { typewrite };