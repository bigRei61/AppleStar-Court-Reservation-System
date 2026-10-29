import test from "node:test";
import assert from "node:assert/strict";
import { productionSiteUrl, resolveSiteUrl } from "../lib/site-url.ts";

test("production email links use the live venue when no URL is configured", () => {
  assert.equal(resolveSiteUrl({ production: true }), "https://apple-star-court-reservation-system.vercel.app");
});

test("Vercel's stable production hostname is used ahead of a platform fallback", () => {
  assert.equal(resolveSiteUrl({ production: true, productionHost: "venue.vercel.app", platformUrl: "https://other.example.com" }), "https://venue.vercel.app");
});

test("copied localhost settings cannot leak into production email links", () => {
  for (const configuredUrl of ["http://localhost:3000", "https://localhost:3000", "http://127.0.0.1:3000", "https://127.0.0.1", "https://[::1]:3000"]) {
    assert.equal(resolveSiteUrl({ configuredUrl, production: true }), productionSiteUrl, configuredUrl);
    assert.equal(resolveSiteUrl({ configuredUrl, productionHost: "venue.vercel.app", production: true }), "https://venue.vercel.app", configuredUrl);
  }
});

test("a custom HTTPS domain remains the canonical email destination", () => {
  assert.equal(resolveSiteUrl({ configuredUrl: " https://courts.example.com/ ", productionHost: "venue.vercel.app", production: true }), "https://courts.example.com");
});

test("unsafe or malformed deployment settings fall back without exposing credentials", () => {
  for (const configuredUrl of ["javascript:alert(1)", "https://user:password@example.com", "http://courts.example.com", "https://", " "]) {
    assert.equal(resolveSiteUrl({ configuredUrl, production: true }), productionSiteUrl, configuredUrl);
  }
});

test("local development keeps working on its current host and port", () => {
  assert.equal(resolveSiteUrl(), "http://localhost:3000");
  assert.equal(resolveSiteUrl({ configuredUrl: "http://localhost:3001/" }), "http://localhost:3001");
});
