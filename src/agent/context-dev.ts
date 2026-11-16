const BASE_URL = "https://api.context.dev/v1";

export interface SearchResult {
  readonly url: string;
  readonly title: string;
  readonly description: string;
}

async function post<T>(apiKey: string, path: string, body: unknown): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`context.dev ${path} failed with ${response.status}: ${detail}`);
  }
  return (await response.json()) as T;
}

export async function search(apiKey: string, query: string): Promise<SearchResult[]> {
  const body = await post<{ results: SearchResult[] }>(apiKey, "/web/search", {
    query,
    numResults: 8,
    country: "it",
    languages: ["it"],
  });
  return body.results.map(({ url, title, description }) => ({ url, title, description }));
}

/** context.dev waits up to 90 seconds on sites it cannot load. Fail sooner and fall back. */
const SCRAPE_TIMEOUT_MS = 25_000;
const DIRECT_TIMEOUT_MS = 15_000;

export interface Page {
  readonly title: string;
  readonly markdown: string;
}

async function scrape(apiKey: string, url: string): Promise<Page> {
  const body = await post<{
    markdown: { success: boolean | null; data: string | null; message?: string };
    metadata?: { title?: string };
  }>(apiKey, "/web/scrape", {
    url,
    formats: { markdown: true },
    sharedParams: { mainContentOnly: true },
    timeoutOpts: { milliseconds: SCRAPE_TIMEOUT_MS },
  });
  if (body.markdown.success !== true || body.markdown.data === null) {
    throw new Error(body.markdown.message ?? `context.dev could not read ${url}`);
  }
  return { title: body.metadata?.title ?? url, markdown: body.markdown.data };
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

const htmlToText = (html: string) =>
  html
    .replace(/<(script|style|nav|header|footer|noscript|svg)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<a\b[^>]*href="(https?:[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)")
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&([a-z]+);/gi, (match, name: string) => ENTITIES[name.toLowerCase()] ?? match)
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();

/** Plain fetch for HTML pages context.dev cannot load, such as difesa.it. No JavaScript rendering, no PDFs. */
async function fetchDirect(url: string): Promise<Page> {
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
      "accept-language": "it-IT,it;q=0.9",
    },
    signal: AbortSignal.timeout(DIRECT_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  if (!(response.headers.get("content-type") ?? "").includes("html")) throw new Error(`${url} is not an HTML page`);
  const html = await response.text();
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() ?? url;
  const text = htmlToText(html);
  if (text.length < 200) throw new Error(`${url} returned no readable text`);
  return { title: htmlToText(title), markdown: text };
}

export async function readPage(apiKey: string, url: string): Promise<Page> {
  try {
    return await scrape(apiKey, url);
  } catch (scrapeError) {
    try {
      return await fetchDirect(url);
    } catch {
      throw scrapeError;
    }
  }
}
