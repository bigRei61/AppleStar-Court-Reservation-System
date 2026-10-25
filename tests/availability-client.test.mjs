import { test } from "node:test";
import assert from "node:assert/strict";
import { createAvailabilityReader } from "../lib/availability-client.ts";

const date = "2026-10-25";
const schedule = (day = date) => ({ date: day, courts: [{ id: "court-1", name: "Court 1", is_active: true }], hours: [], unavailable: [], fetchedAt: "2026-10-25T00:00:00Z" });
const response = (data = schedule()) => Response.json(data);

test("concurrent schedule consumers share one public request", async () => {
  let calls = 0;
  const reader = createAvailabilityReader({ fetcher: async (_url, options) => {
    calls++;
    assert.equal(options.credentials, "omit");
    assert.equal(options.cache, "no-store");
    assert.ok(options.signal);
    return response();
  } });
  const [a, b] = await Promise.all([reader.load(date), reader.load(date)]);
  assert.equal(calls, 1);
  assert.equal(a, b);
});

test("returning to a fresh date is immediate, expired dates and forced refreshes reload", async () => {
  let calls = 0; let clock = 0;
  const reader = createAvailabilityReader({ now: () => clock, ttlMs: 100, fetcher: async () => { calls++; return response(); } });
  const first = await reader.load(date);
  assert.equal(reader.peek(date), first);
  assert.equal(await reader.load(date), first);
  assert.equal(calls, 1);
  await reader.load(date, true);
  assert.equal(calls, 2);
  clock = 101;
  assert.equal(reader.peek(date), undefined);
  await reader.load(date);
  assert.equal(calls, 3);
});

test("a transient schedule outage is retried once", async () => {
  let calls = 0;
  const reader = createAvailabilityReader({ fetcher: async () => ++calls === 1 ? new Response(null, { status: 503 }) : response() });
  assert.equal((await reader.load(date)).date, date);
  assert.equal(calls, 2);
});

test("an invalid date request fails immediately and never enters the cache", async () => {
  let calls = 0;
  const reader = createAvailabilityReader({ fetcher: async () => { calls++; return new Response(null, { status: 400 }); } });
  await assert.rejects(reader.load(date));
  assert.equal(calls, 1);
  assert.equal(reader.peek(date), undefined);
});

test("an unexpected response cannot display another date's schedule", async () => {
  const reader = createAvailabilityReader({ fetcher: async () => response(schedule("2026-10-26")) });
  await assert.rejects(reader.load(date));
  assert.equal(reader.peek(date), undefined);
});

test("failed requests clear pending state so retry can recover", async () => {
  let offline = true; let calls = 0;
  const reader = createAvailabilityReader({ fetcher: async () => { calls++; if (offline) throw new TypeError("Network unavailable"); return response(); } });
  await assert.rejects(reader.load(date));
  assert.equal(calls, 2);
  offline = false;
  assert.equal((await reader.load(date)).date, date);
  assert.equal(calls, 3);
});

test("a failed background refresh retains the last successful schedule", async () => {
  let offline = false;
  const reader = createAvailabilityReader({ fetcher: async () => { if (offline) throw new TypeError("Network unavailable"); return response(); } });
  const first = await reader.load(date);
  offline = true;
  await assert.rejects(reader.load(date, true));
  assert.equal(reader.peek(date), first);
});

test("a response started before booking invalidation cannot replace fresher availability", async () => {
  const replies = [];
  const reader = createAvailabilityReader({ fetcher: () => new Promise((resolve) => replies.push(resolve)) });
  const oldRequest = reader.load(date);
  reader.invalidate(date);
  const freshRequest = reader.load(date);
  const fresh = { ...schedule(), unavailable: [{ court_id: "court-1", start_time: "2026-10-25T04:00:00Z", end_time: "2026-10-25T05:00:00Z", kind: "booking" }] };
  replies[1](response(fresh));
  const latest = await freshRequest;
  replies[0](response());
  await oldRequest;
  assert.equal(reader.peek(date), latest);
  assert.equal(reader.peek(date).unavailable.length, 1);
});

test("stalled requests time out instead of leaving the schedule loading forever", async () => {
  let calls = 0;
  const reader = createAvailabilityReader({ timeoutMs: 10, fetcher: (_url, { signal }) => new Promise((_resolve, reject) => {
    calls++;
    const keepAlive = setTimeout(() => reject(new Error("Timeout did not abort")), 250);
    signal.addEventListener("abort", () => { clearTimeout(keepAlive); reject(signal.reason); }, { once: true });
  }) });
  await assert.rejects(reader.load(date), { name: "TimeoutError" });
  assert.equal(calls, 2);
  assert.equal(reader.peek(date), undefined);
});
