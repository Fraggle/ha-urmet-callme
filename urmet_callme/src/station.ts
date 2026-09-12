// Learned 2Voice station (OUTGOING) accounts, keyed by place id.
//
// Phase-B devices are absent from get_my_devices. The station SIP name is the device's MAC, read
// from the registrar's Contact census and stored here so a restart does not need the device online.
// `/data` is the add-on's persistent volume; outside it the cache is memory-only.
import { readFileSync, writeFileSync } from "node:fs";
import { logger } from "./logger.js";

const log = logger("station");
const FILE = "/data/urmet-stations.json";

let cache: Record<string, string> | undefined;

function load(): Record<string, string> {
  if (cache) return cache;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(FILE, "utf8"));
  } catch {
    parsed = undefined;
  }
  cache =
    parsed && typeof parsed === "object"
      ? (parsed as Record<string, string>)
      : {};
  return cache;
}

export function loadStation(placeId: string): string | undefined {
  return load()[placeId] || undefined;
}

export function saveStation(placeId: string, station: string): void {
  const all = load();
  all[placeId] = station;
  try {
    writeFileSync(FILE, JSON.stringify(all));
  } catch (e) {
    log.warn(
      `could not persist the learned station (${(e as Error).message}); ` +
        "it will be rediscovered on the next start",
    );
  }
}
