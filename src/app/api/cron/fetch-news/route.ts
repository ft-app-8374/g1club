import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const FEEDS = [
  { url: "https://www.racingnsw.com.au/feed/", source: "Racing NSW" },
  { url: "https://www.anzbloodstocknews.com/feed/", source: "ANZ Bloodstock" },
];

interface FeedEntry {
  title: string;
  link: string;
  pubDate: string;
  source: string;
}

function extractItems(xml: string, source: string): FeedEntry[] {
  const items: FeedEntry[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const content = match[1];
    const title = content.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1]
      || content.match(/<title>(.*?)<\/title>/)?.[1]
      || "";
    const link = content.match(/<link>(.*?)<\/link>/)?.[1] || "";
    const pubDate = content.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || "";

    if (title && link) {
      items.push({
        title: decodeHtmlEntities(title.trim()),
        link: link.trim(),
        pubDate,
        source,
      });
    }
  }
  return items;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#8217;/g, "\u2019")
    .replace(/&#8216;/g, "\u2018")
    .replace(/&#8211;/g, "\u2013");
}

// POST /api/cron/fetch-news — pull latest from RSS feeds
export async function POST(req: Request) {
  // Auth check
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let totalAdded = 0;

  for (const feed of FEEDS) {
    try {
      const res = await fetch(feed.url, {
        headers: { "User-Agent": "Group1Club/1.0" },
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) continue;
      const xml = await res.text();
      const items = extractItems(xml, feed.source).slice(0, 5); // Latest 5 per feed

      for (const item of items) {
        // Check for duplicates by sourceUrl
        const exists = await prisma.feedItem.findFirst({
          where: { sourceUrl: item.link },
        });
        if (exists) continue;

        await prisma.feedItem.create({
          data: {
            type: "news",
            title: item.title,
            source: item.source,
            sourceUrl: item.link,
          },
        });
        totalAdded++;
      }
    } catch (e) {
      console.error(`Failed to fetch ${feed.source}:`, e);
    }
  }

  return NextResponse.json({
    message: "News fetch complete",
    added: totalAdded,
    sources: FEEDS.length,
  });
}
