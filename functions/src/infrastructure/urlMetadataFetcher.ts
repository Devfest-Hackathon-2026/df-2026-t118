// URL から OGP・タイトル・本文抜粋を安全に取得する（R04: SSRF 対策 & 取得失敗の正直な返却）。
// 取得が拒否・失敗した場合は fetched: false を返し、読めたふりをしない。
export async function fetchUrlMetadata(rawUrl: string): Promise<{
  fetched: boolean;
  domain: string;
  title: string;
  description: string;
  snippet: string;
}> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { fetched: false, domain: 'web', title: rawUrl, description: '', snippet: '' };
  }
  // SSRF 対策: http/https 以外およびプライベート IP・ループバック・メタデータ IP へのアクセスを拒否
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { fetched: false, domain: 'web', title: rawUrl, description: '', snippet: '' };
  }
  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '::1' ||
    host === '[::1]' ||
    host === '0.0.0.0' ||
    host.startsWith('127.') ||
    host.startsWith('10.') ||
    host.startsWith('192.168.') ||
    host.startsWith('169.254.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
    host.endsWith('.internal') ||
    host.endsWith('.local')
  ) {
    return { fetched: false, domain: host, title: rawUrl, description: '', snippet: '' };
  }

  const domain = host.replace(/^www\./, '');
  // Instagram 等のログイン壁があるドメインは公式 API なしで投稿本文を取得できないため、読めたふりをしない（F02/R04）
  if (domain.includes('instagram.com')) {
    return {
      fetched: false,
      domain: 'Instagram',
      title: 'Instagramの投稿リンク',
      description: '',
      snippet: '',
    };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(rawUrl, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HannariIslandBot/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timer);
    if (!res.ok) {
      return {
        fetched: false,
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

    const hasContent = Boolean(ogTitle || ogDesc || bodyText.length > 20);
    return {
      fetched: hasContent,
      domain,
      title: ogTitle || domain,
      description: ogDesc.slice(0, 400),
      snippet: bodyText,
    };
  } catch {
    return {
      fetched: false,
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
