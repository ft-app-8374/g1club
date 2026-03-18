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
 * Finds the earliest race time at that venue in the same round.
 * Cutoff IS the first race start time (no subtraction).
 */
export async function getCutoffForVenueOnDay(
  venue: string,
  raceTime: Date,
  roundId: string
): Promise<Date> {
  // Find earliest race at this venue in the same round
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
  return new Date(firstRaceTime);
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
    select: { venue: true, raceTime: true },
    orderBy: { raceTime: "asc" },
  });

  const cutoffs = new Map<string, Date>();
  for (const race of races) {
    if (!cutoffs.has(race.venue)) {
      cutoffs.set(race.venue, new Date(race.raceTime));
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
            select: { venue: true, raceTime: true },
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
    // Build venue -> earliest race time
    const venueFirstRace = new Map<string, Date>();
    for (const race of round.races) {
      if (!venueFirstRace.has(race.venue)) {
        venueFirstRace.set(race.venue, race.raceTime);
      }
    }

    for (const venue of Array.from(venueFirstRace.keys())) {
      const cutoff = new Date(venueFirstRace.get(venue)!);

      if (cutoff > now) {
        if (!nearest || cutoff < nearest.cutoff) {
          nearest = { cutoff, venue, roundName: round.name, roundId: round.id };
        }
      }
    }
  }

  return nearest;
}
