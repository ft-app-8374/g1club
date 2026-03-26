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
 */
export async function getCutoffForRace(raceId: string): Promise<Date> {
  const race = await prisma.race.findUnique({
    where: { id: raceId },
    select: { venue: true, raceTime: true, roundId: true },
  });

  if (!race) throw new Error(`Race ${raceId} not found`);

  return getCutoffForVenueOnDay(race.venue, race.raceTime, race.roundId);
}

/**
 * Get cutoff for a venue on a specific race day.
 *
 * When race1StartTime is available (fetched from Betfair), the cutoff is
 * Race 1 jump time — tips lock when the first race at the venue starts.
 *
 * Fallback: 30 minutes before the first Group 1 race at the venue.
 */
export async function getCutoffForVenueOnDay(
  venue: string,
  raceTime: Date,
  roundId: string
): Promise<Date> {
  // Prefer Race 1 start time if available
  const raceWithR1 = await prisma.race.findFirst({
    where: { roundId, venue, race1StartTime: { not: null } },
    select: { race1StartTime: true },
  });

  if (raceWithR1?.race1StartTime) {
    return new Date(raceWithR1.race1StartTime);
  }

  // Fallback: 30 min before first G1 race at this venue
  const earliestRace = await prisma.race.findFirst({
    where: {
      roundId,
      venue,
      status: { not: "abandoned" },
    },
    orderBy: { raceTime: "asc" },
    select: { raceTime: true },
  });

  const firstRaceTime = earliestRace?.raceTime || raceTime;
  const cutoff = new Date(firstRaceTime);
  cutoff.setMinutes(cutoff.getMinutes() - 30);
  return cutoff;
}

/**
 * Check if tips are still open for a given race.
 */
export async function areTipsOpen(raceId: string): Promise<boolean> {
  const race = await prisma.race.findUnique({
    where: { id: raceId },
    select: { status: true, venue: true, raceTime: true, roundId: true },
  });

  if (!race || race.status !== "open") return false;

  const cutoff = await getCutoffForVenueOnDay(race.venue, race.raceTime, race.roundId);
  return new Date() < cutoff;
}

/**
 * Get all venue cutoffs for a round.
 * Returns a map of venue -> cutoff time.
 */
export async function getVenueCutoffs(roundId: string): Promise<Map<string, Date>> {
  const races = await prisma.race.findMany({
    where: { roundId, status: { not: "abandoned" } },
    select: { venue: true, raceTime: true, race1StartTime: true },
    orderBy: { raceTime: "asc" },
  });

  const cutoffs = new Map<string, Date>();
  // First pass: collect Race 1 times per venue
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
        // Fallback: 30 min before first G1 race
        const cutoff = new Date(race.raceTime);
        cutoff.setMinutes(cutoff.getMinutes() - 30);
        cutoffs.set(race.venue, cutoff);
      }
    }
  }

  return cutoffs;
}

/**
 * Get the next upcoming cutoff across all venues in active rounds.
 * Used for the dashboard countdown.
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
    // Build venue -> Race 1 time (if available) and earliest G1 race time
    const venueR1 = new Map<string, Date>();
    const venueFirstRace = new Map<string, Date>();
    for (const race of round.races) {
      if (race.race1StartTime && !venueR1.has(race.venue)) {
        venueR1.set(race.venue, new Date(race.race1StartTime));
      }
      if (!venueFirstRace.has(race.venue)) {
        venueFirstRace.set(race.venue, race.raceTime);
      }
    }

    for (const venue of Array.from(venueFirstRace.keys())) {
      let cutoff: Date;
      if (venueR1.has(venue)) {
        // Use Race 1 start time directly
        cutoff = venueR1.get(venue)!;
      } else {
        // Fallback: 30 min before first G1 race
        cutoff = new Date(venueFirstRace.get(venue)!);
        cutoff.setMinutes(cutoff.getMinutes() - 30);
      }

      if (cutoff > now) {
        if (!nearest || cutoff < nearest.cutoff) {
          nearest = { cutoff, venue, roundName: round.name, roundId: round.id };
        }
      }
    }
  }

  return nearest;
}
