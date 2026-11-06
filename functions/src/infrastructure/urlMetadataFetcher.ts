// URL から OGP・タイトル・本文抜粋を取得する。
// Instagram 等で取得が拒否される場合もエラーにせず URL 構造から推定できるようにする。
export async function fetchUrlMetadata(rawUrl: string): Promise<{
  domain: string;
  title: string;
  description: string;
  snippet: string;
}> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { domain: 'web', title: rawUrl, description: '', snippet: '' };
  }
  // SSRF 対策: http/https 以外およびプライベート IP へのアクセスを拒否する
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { domain: 'web', title: rawUrl, description: '', snippet: '' };
  }
  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host.startsWith('127.') ||
    host.startsWith('10.') ||
    host.startsWith('192.168.') ||
    host.startsWith('169.254.') ||
    host.endsWith('.internal')
  ) {
    return { domain: host, title: rawUrl, description: '', snippet: '' };
  }

  const domain = host.replace(/^www\./, '');
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const res = await fetch(rawUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HannariIslandBot/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timer);
    if (!res.ok) {
      return {
        domain,
        title: decodeURIComponent(parsed.pathname).slice(1) || domain,
        description: '',
        snippet: '',
      };
    }
    const html = (await res.text()).slice(0, 60000);
    const extractMeta = (prop: string): string => {
      const m =
        html.match(
          new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i')
        ) ||
        html.match(
          new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i')
        );
      return m ? decodeHtmlEntities(m[1].trim()) : '';
    };
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const ogTitle =
      extractMeta('og:title') || (titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : '');
    const ogDesc = extractMeta('og:description') || extractMeta('description');
    const bodyText = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 1000);

    return {
      domain,
      title: ogTitle || domain,
      description: ogDesc.slice(0, 400),
      snippet: bodyText,
    };
  } catch {
    return {
      domain,
      title: decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || domain),
      description: '',
      snippet: '',
    };
  }
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}
