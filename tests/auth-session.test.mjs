import test from "node:test";
import assert from "node:assert/strict";
import { setImmediate as tick, setTimeout as delay } from "node:timers/promises";
import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { observeAuthSession } from "../lib/auth-session.ts";

// Exercise the installed SDKs with an isolated Auth service and cookie jar.
// No accounts, emails, or sessions are created in the hosted project.
async function waitFor(check) {
  const end = Date.now() + 1000;
  while (!check() && Date.now() < end) await delay(5);
  assert.ok(check(), "expected the deferred session refresh");
}

function fixture(t) {
  const jar = new Map();
  let user = { id: "11111111-1111-4111-8111-111111111111", aud: "authenticated", email: "player@example.test", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
  const cookies = {
    getAll: () => Array.from(jar, ([name, value]) => ({ name, value })),
    setAll: (values) => values.forEach(({ name, value, options }) => {
      assert.equal(options.path, "/", "session must be available on every page");
      if (options.maxAge === 0) jar.delete(name);
      else jar.set(name, value);
    }),
  };
  const session = () => {
    const expires_at = Math.floor(Date.now() / 1000) + 3600;
    const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
    return { access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, aud: "authenticated", exp: expires_at })}.dGVzdA`, refresh_token: "fixture-refresh", expires_in: 3600, expires_at, token_type: "bearer", user };
  };
  const fetch = async (input) => {
    const path = new URL(typeof input === "string" ? input : input.url).pathname;
    if (path.endsWith("/logout")) return new Response(null, { status: 204 });
    return Response.json(path.endsWith("/user") ? user : session());
  };
  const url = "https://fixture.supabase.test";
  const key = "fixture-publishable-key";
  const client = createBrowserClient(url, key, { isSingleton: false, cookies, global: { fetch }, auth: { autoRefreshToken: false, detectSessionInUrl: false } });
  const clients = [client];
  t.after(() => Promise.all(clients.map((client) => client.auth.dispose())));
  return {
    client, jar,
    server: () => { const client = createServerClient(url, key, { cookies, global: { fetch } }); clients.push(client); return client; },
    switchUser: () => { user = { ...user, id: "22222222-2222-4222-8222-222222222222" }; },
  };
}

test("a new signup is readable by server pages and logout removes that session", async (t) => {
  const { client, server, jar } = fixture(t);
  const identities = [];
  let refreshes = 0;
  const stop = observeAuthSession(client, (id) => identities.push(id), () => refreshes++);
  try {
    await client.auth.getSession();
    await tick();
    assert.deepEqual(identities, [null]);
    const signup = await client.auth.signUp({ email: "player@example.test", password: "fixture-password" });
    assert.equal(signup.error, null);
    assert.ok(jar.size > 0);
    const viewer = await server().auth.getUser();
    assert.equal(viewer.error, null);
    assert.equal(viewer.data.user.id, identities.at(-1));
    const claims = await server().auth.getClaims();
    assert.equal(claims.error, null);
    assert.equal(claims.data.claims.sub, viewer.data.user.id);
    await waitFor(() => refreshes === 1);
    await client.auth.signOut();
    await waitFor(() => refreshes === 2);
    assert.equal(identities.at(-1), null);
    assert.equal(refreshes, 2);
    assert.equal((await server().auth.getUser()).data.user, null);
  } finally { stop(); }
});

test("restored cookies give the browser and server the same player without a reload loop", async (t) => {
  const { client, server } = fixture(t);
  await client.auth.signInWithPassword({ email: "player@example.test", password: "fixture-password" });
  let browserUser;
  let refreshes = 0;
  const stop = observeAuthSession(client, (id) => { browserUser = id; }, () => refreshes++);
  try {
    await tick();
    assert.equal(browserUser, (await server().auth.getUser()).data.user.id);
    assert.equal(refreshes, 0);
  } finally { stop(); }
});

test("routine token refreshes and repeated sign-in events do not reload pages", async (t) => {
  const { client } = fixture(t);
  let refreshes = 0;
  const stop = observeAuthSession(client, () => {}, () => refreshes++);
  try {
    await client.auth.getSession();
    await tick();
    await client.auth.signInWithPassword({ email: "player@example.test", password: "fixture-password" });
    await waitFor(() => refreshes === 1);
    await client.auth.refreshSession();
    await client.auth.signInWithPassword({ email: "player@example.test", password: "fixture-password" });
    await delay(10);
    assert.equal(refreshes, 1);
  } finally { stop(); }
});

test("switching players invalidates the old user's page state", async (t) => {
  const { client, switchUser } = fixture(t);
  await client.auth.signInWithPassword({ email: "player@example.test", password: "fixture-password" });
  let userId;
  let refreshes = 0;
  const stop = observeAuthSession(client, (id) => { userId = id; }, () => refreshes++);
  try {
    await tick();
    const first = userId;
    switchUser();
    await client.auth.signInWithPassword({ email: "other@example.test", password: "fixture-password" });
    await waitFor(() => refreshes === 1);
    assert.notEqual(userId, first);
    assert.equal(refreshes, 1);
  } finally { stop(); }
});

test("unmounting cancels a queued refresh and removes the auth listener", async (t) => {
  const { client } = fixture(t);
  let notifications = 0;
  let refreshes = 0;
  const stop = observeAuthSession(client, () => notifications++, () => refreshes++);
  await client.auth.getSession();
  await tick();
  await client.auth.signInWithPassword({ email: "player@example.test", password: "fixture-password" });
  stop();
  const count = notifications;
  await client.auth.signOut();
  await tick();
  assert.equal(refreshes, 0);
  assert.equal(notifications, count);
});
