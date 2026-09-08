import { createHash } from "node:crypto";

// Utils.computeSHA1(ts + "$" + password) -> lowercase hex (Apache Hex.encodeHex).
export function buildToken(tsSeconds: number, channelPassword: string): string {
  return createHash("sha1")
    .update(`${tsSeconds}$${channelPassword}`)
    .digest("hex");
}
