const BROADCAST_ID_SYMBOL = Symbol.for("__modelFavoritesBroadcastId");

function createBroadcastId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `fav-${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;
}

export function getFavoritesBroadcastId(): string {
  if (typeof globalThis === "undefined") {
    return createBroadcastId();
  }

  const globalObject = globalThis as Record<PropertyKey, unknown>;
  if (!globalObject[BROADCAST_ID_SYMBOL]) {
    globalObject[BROADCAST_ID_SYMBOL] = createBroadcastId();
  }

  return globalObject[BROADCAST_ID_SYMBOL] as string;
}
