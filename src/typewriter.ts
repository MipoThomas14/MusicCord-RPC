async function typewriterF(message: string): Promise<void> {
    return new Promise(async (resolve) => {
    for (const char of message) {
      process.stdout.write(char);
      await new Promise(r => setTimeout(r, 75));
    }
    process.stdout.write("\n");
    resolve();
  });
}


module.exports = { typewriterF };