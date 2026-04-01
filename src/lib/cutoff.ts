import { prisma } from "./prisma";

/**
 * Calculate the tip cutoff time for a specific race.
 *
 * Cutoff = the start time of the first race at the same venue on the same day.
 * This means all tips for a given track are locked at the same time,
 * regardless of which race number the tip is for.
 *
 * When multiple venues race on the same day (e.g. Flemington + Randwick),
 * each venue has its own independent cutoff.
 *
 * Returns null if no race1StartTime has been set for the venue yet.
 * No cutoff = tips stay open.
 */
export async function getCutoffForRace(raceId: string): Promise<Date | null> {
  const race = await prisma.race.findUnique({
    where: { id: raceId },
    select: { venue: true, raceTime: true, roundId: true },
  });

  if (!race) throw new Error(`Race ${raceId} not found`);

  return getCutoffForVenueOnDay(race.venue, race.roundId);
}

/**
 * Get cutoff for a venue on a specific race day.
 *
 * Returns the Race 1 jump time if available (fetched from Betfair).
 * Returns null if no race1StartTime has been set — no cutoff means tips stay open.
 * There is no fallback; only a confirmed Race 1 start time triggers lockout.
 */
export async function getCutoffForVenueOnDay(
  venue: string,
  roundId: string
): Promise<Date | null> {
  const raceWithR1 = await prisma.race.findFirst({
    where: { roundId, venue, race1StartTime: { not: null } },
    select: { race1StartTime: true },
  });

  if (raceWithR1?.race1StartTime) {
    return new Date(raceWithR1.race1StartTime);
  }

  // No race1StartTime set — no cutoff, tips stay open
  return null;
}

/**
 * Check if tips are still open for a given race.
 *
 * Tips are open when:
 * - The race status is "open", AND
 * - Either there is no cutoff yet (race1StartTime not set), OR
 *   the current time is before the cutoff.
 *
 * No cutoff = tips stay open (lockout hasn't been set yet).
 */
export async function areTipsOpen(raceId: string): Promise<boolean> {
  const race = await prisma.race.findUnique({
    where: { id: raceId },
    select: { status: true, venue: true, raceTime: true, roundId: true },
  });

  if (!race || race.status !== "open") return false;

  const cutoff = await getCutoffForVenueOnDay(race.venue, race.roundId);

  // No cutoff set yet — tips stay open
  if (cutoff === null) return true;

  return new Date() < cutoff;
}

/**
 * Get all venue cutoffs for a round.
 * Returns a map of venue -> cutoff time (or null if no race1StartTime set).
 * Venues without a confirmed Race 1 start time get null — no cutoff, tips stay open.
 */
export async function getVenueCutoffs(roundId: string): Promise<Map<string, Date | null>> {
  const races = await prisma.race.findMany({
    where: { roundId, status: { not: "abandoned" } },
    select: { venue: true, raceTime: true, race1StartTime: true },
    orderBy: { raceTime: "asc" },
  });

  const cutoffs = new Map<string, Date | null>();
  // Collect Race 1 times per venue
  const venueR1 = new Map<string, Date>();
  for (const race of races) {
    if (race.race1StartTime && !venueR1.has(race.venue)) {
      venueR1.set(race.venue, new Date(race.race1StartTime));
    }
  }

  for (const race of races) {
    if (!cutoffs.has(race.venue)) {
      if (venueR1.has(race.venue)) {
        // Use Race 1 start time directly as cutoff
        cutoffs.set(race.venue, venueR1.get(race.venue)!);
      } else {
        // No race1StartTime — no cutoff, tips stay open
        cutoffs.set(race.venue, null);
      }
    }
  }

  return cutoffs;
}

/**
 * Get the next upcoming cutoff across all venues in active rounds.
 * Used for the dashboard countdown.
 *
 * Only returns confirmed cutoffs (venues with a race1StartTime).
 * Venues without a cutoff are skipped — they have no lockout to count down to.
 */
export async function getNextCutoff(): Promise<{
  cutoff: Date;
  venue: string;
  roundName: string;
  roundId: string;
} | null> {
  const now = new Date();

  const carnival = await prisma.carnival.findFirst({
    where: { status: { in: ["active", "upcoming"] } },
    include: {
      rounds: {
        where: { status: { not: "settled" } },
        include: {
          races: {
            where: { status: { not: "abandoned" } },
            select: { venue: true, raceTime: true, race1StartTime: true },
            orderBy: { raceTime: "asc" },
          },
        },
        orderBy: { number: "asc" },
      },
    },
  });

  if (!carnival) return null;

  let nearest: { cutoff: Date; venue: string; roundName: string; roundId: string } | null = null;

  for (const round of carnival.rounds) {
    // Build venue -> Race 1 time (only confirmed cutoffs)
    const venueR1 = new Map<string, Date>();
    for (const race of round.races) {
      if (race.race1StartTime && !venueR1.has(race.venue)) {
        venueR1.set(race.venue, new Date(race.race1StartTime));
      }
    }

    // Only iterate venues that have a confirmed Race 1 cutoff
    for (const [venue, cutoff] of Array.from(venueR1.entries())) {
      if (cutoff > now) {
        if (!nearest || cutoff < nearest.cutoff) {
          nearest = { cutoff, venue, roundName: round.name, roundId: round.id };
        }
      }
    }
  }

  return nearest;
}
