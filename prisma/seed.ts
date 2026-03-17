import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Admin users
  const mercHash = await bcrypt.hash("merc2026", 10);
  const millsHash = await bcrypt.hash("mills2026", 10);
  const deanHash = await bcrypt.hash("dean2026", 10);

  const merc = await prisma.user.upsert({
    where: { username: "Merc" },
    update: {},
    create: {
      username: "Merc",
      email: "clayton.mccloud@hotmail.com",
      passwordHash: mercHash,
      role: "admin",
      isFinancial: true,
    },
  });

  const mills = await prisma.user.upsert({
    where: { username: "Mills" },
    update: { role: "member" },
    create: {
      username: "Mills",
      email: "millermanhill@gmail.com",
      passwordHash: millsHash,
      role: "member",
      isFinancial: true,
    },
  });

  await prisma.user.upsert({
    where: { username: "Dean" },
    update: { role: "admin", email: "deanlawrence01@gmail.com" },
    create: {
      username: "Dean",
      email: "deanlawrence01@gmail.com",
      passwordHash: deanHash,
      role: "admin",
      isFinancial: true,
    },
  });

  // Test member accounts
  const snakeHash = await bcrypt.hash("snake2026", 10);
  const natoHash = await bcrypt.hash("nato2026", 10);
  await prisma.user.upsert({
    where: { username: "Snake" },
    update: { role: "admin" },
    create: {
      username: "Snake",
      email: "jmennen@outlook.com",
      passwordHash: snakeHash,
      role: "admin",
      isFinancial: true,
    },
  });

  await prisma.user.upsert({
    where: { username: "Nato" },
    update: {},
    create: {
      username: "Nato",
      email: "natomeulenberg@gmail.com",
      passwordHash: natoHash,
      role: "member",
      isFinancial: true,
    },
  });

  console.log("  Users created: Merc (admin), Dean (admin), Snake (admin), Mills, Nato (members)");

  // Test invite code
  await prisma.inviteCode.upsert({
    where: { code: "SPRING2026" },
    update: {},
    create: {
      code: "SPRING2026",
      createdBy: merc.id,
      expiresAt: new Date("2026-12-31"),
    },
  });

  console.log("  Invite code: SPRING2026");

  // Honour Roll
  const honourRollData = [
    {
      year: 2025,
      winnerName: "Law",
      winnerProfit: 3055.1,
      runnerUpName: "TheCat",
      runnerUpProfit: 1437.6,
      thirdName: "Chriso",
      thirdProfit: 1274.0,
      woodenSpoonName: "Simmo",
      woodenSpoonProfit: -4900.0,
      entrants: 53,
      races: 42,
      notes: "Law's 2nd title — also won Cup Week Hero and Captain Consistency",
    },
    {
      year: 2024,
      winnerName: "Snake",
      winnerProfit: 3959.2,
      runnerUpName: "Rusty",
      runnerUpProfit: 3239.1,
      thirdName: null,
      thirdProfit: null,
      woodenSpoonName: "Gav",
      woodenSpoonProfit: -4035.0,
      entrants: 44,
      races: 47,
      notes: null,
    },
    {
      year: 2023,
      winnerName: "Austin",
      winnerProfit: 5864.0,
      runnerUpName: "Wardy",
      runnerUpProfit: 4411.9,
      thirdName: null,
      thirdProfit: null,
      woodenSpoonName: "TeeDee",
      woodenSpoonProfit: -4700.0,
      entrants: 42,
      races: 47,
      notes: null,
    },
    {
      year: 2022,
      winnerName: "Worm",
      winnerProfit: 2833.5,
      runnerUpName: "SimBetTM",
      runnerUpProfit: 2609.0,
      thirdName: null,
      thirdProfit: null,
      woodenSpoonName: "Mayesy",
      woodenSpoonProfit: -3265.0,
      entrants: 51,
      races: 51,
      notes: null,
    },
    {
      year: 2021,
      winnerName: "Rodda",
      winnerProfit: 2168.4,
      runnerUpName: "Nelso",
      runnerUpProfit: 2114.0,
      thirdName: null,
      thirdProfit: null,
      woodenSpoonName: "Simmo",
      woodenSpoonProfit: -3278.0,
      entrants: 47,
      races: 39,
      notes: "Rodda's 3rd title",
    },
    {
      year: 2020,
      winnerName: "Ciaran",
      winnerProfit: 2252.5,
      runnerUpName: "Skinny",
      runnerUpProfit: 1745.0,
      thirdName: null,
      thirdProfit: null,
      woodenSpoonName: "Doc",
      woodenSpoonProfit: -3570.0,
      entrants: 32,
      races: 40,
      notes: null,
    },
    {
      year: 2019,
      winnerName: "Rodda",
      winnerProfit: 1696.0,
      runnerUpName: "Hassall",
      runnerUpProfit: 907.0,
      thirdName: null,
      thirdProfit: null,
      woodenSpoonName: "Simmo",
      woodenSpoonProfit: -3399.62,
      entrants: 19,
      races: 34,
      notes: null,
    },
    {
      year: 2018,
      winnerName: "Law",
      winnerProfit: 3069.44,
      runnerUpName: "Buzza",
      runnerUpProfit: 1096.5,
      thirdName: null,
      thirdProfit: null,
      woodenSpoonName: "Rodda",
      woodenSpoonProfit: -2586.0,
      entrants: 12,
      races: 28,
      notes: "Law's 1st title",
    },
    {
      year: 2017,
      winnerName: "Miller*",
      winnerProfit: 1197.0,
      runnerUpName: "Hassall",
      runnerUpProfit: 1166.0,
      thirdName: null,
      thirdProfit: null,
      woodenSpoonName: "Simmo",
      woodenSpoonProfit: -2528.0,
      entrants: 11,
      races: 28,
      notes:
        "Won under exceptionally dubious circumstances — no official Golden Pony",
    },
    {
      year: 2016,
      winnerName: "Rodda",
      winnerProfit: 1248.0,
      runnerUpName: "Simmo",
      runnerUpProfit: 1166.63,
      thirdName: null,
      thirdProfit: null,
      woodenSpoonName: "Ian Macca",
      woodenSpoonProfit: -2160.0,
      entrants: 12,
      races: 27,
      notes: "Rodda's 1st title",
    },
    {
      year: 2014,
      winnerName: "Nato",
      winnerProfit: 0,
      runnerUpName: "Janine",
      runnerUpProfit: null,
      thirdName: null,
      thirdProfit: null,
      woodenSpoonName: null,
      woodenSpoonProfit: null,
      entrants: 24,
      races: null,
      notes: "First year of competition",
    },
  ];

  for (const entry of honourRollData) {
    await prisma.honourRoll.upsert({
      where: { year: entry.year },
      update: entry,
      create: entry,
    });
  }

  console.log(`  Honour roll: ${honourRollData.length} years seeded`);

  // 2026 Carnival skeleton
  const carnival = await prisma.carnival.upsert({
    where: { year: 2026 },
    update: {},
    create: {
      name: "2026 Spring Carnival",
      year: 2026,
      startDate: new Date("2026-08-22"),
      endDate: new Date("2026-11-14"),
      entryFee: 55.0,
      status: "upcoming",
    },
  });

  // Sample rounds based on 2025 structure (dates shifted to 2026)
  const rounds = [
    { number: 1, name: "Round 1 — Winx Stakes Day", date: "2026-08-22" },
    { number: 2, name: "Round 2 — Memsie Stakes Day", date: "2026-08-29" },
    { number: 3, name: "Round 3 — Moir Stakes Night", date: "2026-09-05" },
    { number: 4, name: "Round 4 — Makybe Diva Stakes Day", date: "2026-09-12" },
    { number: 5, name: "Round 5 — Underwood/Golden Rose Day", date: "2026-09-19" },
    { number: 6, name: "Round 6 — Manikato/Flight Stakes", date: "2026-09-25" },
    { number: 7, name: "Round 7 — Turnbull/Epsom Day", date: "2026-10-03" },
    { number: 8, name: "Round 8 — Caulfield Guineas Day", date: "2026-10-10" },
    { number: 9, name: "Round 9 — Caulfield Cup/Everest Day", date: "2026-10-17" },
    { number: 10, name: "Round 10 — Cox Plate Day", date: "2026-10-24" },
    { number: 11, name: "Round 11 — Derby Day", date: "2026-10-31" },
    { number: 12, name: "Round 12 — Melbourne Cup Week", date: "2026-11-03" },
    { number: 13, name: "Round 13 — Champions Day", date: "2026-11-07" },
    { number: 14, name: "Round 14 — Final Day", date: "2026-11-14" },
  ];

  for (const r of rounds) {
    const raceDate = new Date(r.date);
    const cutoffAt = new Date(raceDate);
    cutoffAt.setHours(cutoffAt.getHours() + 12); // Noon cutoff placeholder

    await prisma.round.upsert({
      where: { carnivalId_number: { carnivalId: carnival.id, number: r.number } },
      update: {},
      create: {
        carnivalId: carnival.id,
        number: r.number,
        name: r.name,
        raceDate,
        cutoffAt,
      },
    });
  }

  console.log("  Carnival: 2026 Spring Carnival with 14 rounds");

  // Add sample races for Round 1
  const round1 = await prisma.round.findFirst({
    where: { carnivalId: carnival.id, number: 1 },
  });

  if (round1) {
    await prisma.race.upsert({
      where: { id: "winx-stakes-2026" },
      update: {},
      create: {
        id: "winx-stakes-2026",
        roundId: round1.id,
        name: "Winx Stakes",
        venue: "Randwick",
        distance: 1400,
        raceTime: new Date("2026-08-22T05:45:00Z"), // 3:45pm AEST
        raceNumber: 7,
        grade: "G1",
        raceType: "WFA",
        prizePool: "$1,000,000",
      },
    });

    // Add test runners for Winx Stakes
    const testRunners = [
      { name: "GRINGOTTS", barrier: 1, jockey: "J McDonald", trainer: "C Waller", weight: 58.5 },
      { name: "VIA SISTINA", barrier: 2, jockey: "J Moreira", trainer: "C Waller", weight: 56.5 },
      { name: "PRIDE OF JENNI", barrier: 3, jockey: "C Williams", trainer: "C Maher & D Eustace", weight: 56.5 },
      { name: "MR BRIGHTSIDE", barrier: 4, jockey: "D Lane", trainer: "A & S Freedman", weight: 58.5 },
      { name: "BUCKAROO", barrier: 5, jockey: "W Egan", trainer: "C Waller", weight: 58.5 },
      { name: "ATISHU", barrier: 6, jockey: "K McEvoy", trainer: "J Cummings", weight: 56.5 },
      { name: "ROMANTIC WARRIOR", barrier: 7, jockey: "J Bowman", trainer: "D Whyte", weight: 58.5 },
      { name: "PROGNOSIS", barrier: 8, jockey: "T Marquand", trainer: "A & S Freedman", weight: 58.5 },
      { name: "IVO BLIGH", barrier: 9, jockey: "D Yendall", trainer: "C Maher & D Eustace", weight: 58.5 },
      { name: "WATERFORD", barrier: 10, jockey: "L Currie", trainer: "R Hickmott", weight: 58.5 },
    ];

    for (const r of testRunners) {
      await prisma.runner.upsert({
        where: { raceId_name: { raceId: "winx-stakes-2026", name: r.name } },
        update: {},
        create: {
          raceId: "winx-stakes-2026",
          name: r.name,
          barrier: r.barrier,
          jockey: r.jockey,
          trainer: r.trainer,
          weight: r.weight,
        },
      });
    }

    console.log("  Sample race: Winx Stakes (Round 1) with 10 runners");
  }

  console.log("\nSeed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
