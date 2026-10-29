export const productionSiteUrl = "https://apple-star-court-reservation-system.vercel.app";

type SiteUrlOptions = {
  configuredUrl?: string;
  productionHost?: string;
  platformUrl?: string;
  production?: boolean;
};

export function resolveSiteUrl({ configuredUrl, productionHost, platformUrl, production = false }: SiteUrlOptions = {}) {
  for (const candidate of [configuredUrl, productionHost, platformUrl]) {
    if (!candidate?.trim()) continue;
    try {
      const value = candidate.trim();
      const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) continue;
      const loopback = url.hostname === "localhost" || url.hostname.endsWith(".localhost") || /^127\./.test(url.hostname) || ["0.0.0.0", "[::1]"].includes(url.hostname);
      // A copied development setting must never send production email links to a player's computer.
      if (production && (loopback || url.protocol !== "https:")) continue;
      return url.origin;
    } catch {
      // Fall through to the next deployment setting when one is malformed.
    }
  }
  return production ? productionSiteUrl : "http://localhost:3000";
}
