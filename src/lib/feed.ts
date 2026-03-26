import { prisma } from "./prisma";

/**
 * Create a system-generated feed item.
 * Called by crons when notable events happen (results, scratchings, fields, etc.)
 */
export async function createFeedItem(item: {
  type: string;
  title: string;
  body?: string;
  source?: string;
  sourceUrl?: string;
  raceId?: string;
}) {
  return prisma.feedItem.create({
    data: {
      type: item.type,
      title: item.title,
      body: item.body || null,
      source: item.source || "system",
      sourceUrl: item.sourceUrl || null,
      raceId: item.raceId || null,
    },
  });
}

/**
 * Get the latest feed items for the dashboard.
 */
export async function getLatestFeed(limit = 10) {
  return prisma.feedItem.findMany({
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: limit,
    include: {
      race: { select: { name: true, venue: true } },
    },
  });
}
