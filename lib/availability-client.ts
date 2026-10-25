import type { Availability } from "@/lib/types";

type Options = { fetcher?: typeof fetch; now?: () => number; timeoutMs?: number; ttlMs?: number };

export function createAvailabilityReader({ fetcher = fetch, now = Date.now, timeoutMs = 6500, ttlMs = 15_000 }: Options = {}) {
  const cache = new Map<string, { data: Availability; expires: number }>();
  const pending = new Map<string, Promise<Availability>>();
  function peek(date: string) {
    const value = cache.get(date);
    if (value && value.expires > now()) return value.data;
    cache.delete(date);
    return undefined;
  }
  async function request(date: string) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetcher(`/api/availability?date=${encodeURIComponent(date)}`, {
          cache: "no-store", credentials: "omit", headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!response.ok) {
          if (response.status < 500 && response.status !== 408 && response.status !== 429) throw new InvalidAvailability();
          throw new Error("Availability request failed.");
        }
        const data = await response.json() as Availability;
        if (data.date !== date || !Array.isArray(data.courts) || !Array.isArray(data.hours) || !Array.isArray(data.unavailable)) throw new InvalidAvailability();
        return data;
      } catch (error) {
        if (error instanceof InvalidAvailability || attempt === 1) throw error;
      }
    }
    throw new Error("Availability request failed.");
  }
  function load(date: string, force = false): Promise<Availability> {
    const current = pending.get(date);
    if (current) return current;
    const cached = !force && peek(date);
    if (cached) return Promise.resolve(cached);
    const task = request(date).then((data) => {
      // An invalidated request must not overwrite a newer post-booking result.
      if (pending.get(date) === task) cache.set(date, { data, expires: now() + ttlMs });
      return data;
    }).finally(() => { if (pending.get(date) === task) pending.delete(date); });
    pending.set(date, task);
    return task;
  }
  return { peek, load, invalidate(date: string) { cache.delete(date); pending.delete(date); } };
}

class InvalidAvailability extends Error {}

export const availabilityReader = createAvailabilityReader();
