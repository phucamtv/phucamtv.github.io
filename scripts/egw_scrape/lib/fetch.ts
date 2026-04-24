const USER_AGENT = "phucam.tv-egw-scraper/1.0 (contact: site admin)";

export async function fetchUrl(url: string): Promise<string> {
  const resp = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(30_000),
  });
  if (!resp.ok) {
    throw new Error(`fetch failed ${resp.status} ${resp.statusText}: ${url}`);
  }
  return await resp.text();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
