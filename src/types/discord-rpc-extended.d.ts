import "discord-rpc";

declare module "discord-rpc" {
  interface Presence {
    type?: 0 | 1 | 2 | 3 | 4 | 5; // 2 is listening
  }
}
