/** Simulated network latency so the UI behaves like a real API. */
export function delay(ms = 220): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms * (0.7 + Math.random() * 0.6)));
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function notFound(message: string): never {
  throw new ApiError(404, message);
}

export function unauthorized(message = "Not authorised"): never {
  throw new ApiError(403, message);
}

/** Deferred merge helper: replace `merge` entries in `target`. */
export function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  const idx = list.findIndex((l) => l.id === item.id);
  if (idx === -1) return [...list, item];
  const copy = [...list];
  copy[idx] = item;
  return copy;
}