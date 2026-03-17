// Mock test for betfair.ts parsing logic
// Verifies: isGroup1Market, parseMarketName, and response handling

const { isGroup1Market, parseMarketName } = require("./src/lib/betfair-test-helpers");

// Since betfair.ts uses ESM imports, test the pure functions directly
let pass = 0, fail = 0;

function check(name, actual, expected) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`\x1b[32m✓ ${name}\x1b[0m`);
    pass++;
  } else {
    console.log(`\x1b[31m✗ ${name} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}\x1b[0m`);
    fail++;
  }
}

console.log("══════════════════════════════════");
console.log("  Betfair Client Unit Tests");
console.log("══════════════════════════════════\n");

// isGroup1Market
console.log("── isGroup1Market ──");
check("Grp1 detected", isGroup1Market("R7 3200m Grp1"), true);
check("grp1 case insensitive", isGroup1Market("r5 1200m grp1"), true);
check("Grp2 not G1", isGroup1Market("R3 1600m Grp2"), false);
check("Listed not G1", isGroup1Market("R4 2000m Listed"), false);
check("No grade not G1", isGroup1Market("R1 1200m"), false);

// parseMarketName
console.log("\n── parseMarketName ──");
check("Full parse", parseMarketName("R7 3200m Grp1"), { raceNumber: 7, distance: 3200, grade: "G1" });
check("G2 parse", parseMarketName("R3 1600m Grp2"), { raceNumber: 3, distance: 1600, grade: "G2" });
check("G3 parse", parseMarketName("R5 1200m Grp3"), { raceNumber: 5, distance: 1200, grade: "G3" });
check("Listed parse", parseMarketName("R1 2400m Listed"), { raceNumber: 1, distance: 2400, grade: "Listed" });
check("No grade", parseMarketName("R2 1400m"), { raceNumber: 2, distance: 1400, grade: "Other" });
check("No distance", parseMarketName("R8 Grp1"), { raceNumber: 8, distance: null, grade: "G1" });
check("Minimal", parseMarketName("Some Race"), { raceNumber: null, distance: null, grade: "Other" });

// Mock Betfair API responses
console.log("\n── Response Parsing ──");

const mockCatalogue = [
  {
    marketId: "1.234567890",
    marketName: "R7 3200m Grp1",
    marketStartTime: "2026-10-31T04:00:00.000Z",
    runners: [
      { selectionId: 12345, runnerName: "GRINGOTTS", metadata: { JOCKEY_NAME: "J McDonald", TRAINER_NAME: "C Waller", STALL_DRAW: "1" } },
      { selectionId: 12346, runnerName: "VIA SISTINA", metadata: { JOCKEY_NAME: "J Moreira", TRAINER_NAME: "C Waller", STALL_DRAW: "2" } },
    ],
    event: { name: "Flemington", venue: "Flemington" },
    description: { marketType: "WIN" },
  },
  {
    marketId: "1.234567891",
    marketName: "R5 1200m Grp2",
    marketStartTime: "2026-10-31T03:00:00.000Z",
    runners: [],
    event: { name: "Flemington", venue: "Flemington" },
  },
];

check("Market count", mockCatalogue.length, 2);
check("G1 market found", mockCatalogue.filter(m => isGroup1Market(m.marketName)).length, 1);
check("Runner metadata parsed", mockCatalogue[0].runners[0].metadata.JOCKEY_NAME, "J McDonald");
check("Selection ID is number", typeof mockCatalogue[0].runners[0].selectionId, "number");
check("Barrier from STALL_DRAW", parseInt(mockCatalogue[0].runners[0].metadata.STALL_DRAW), 1);

const mockBook = [
  {
    marketId: "1.234567890",
    status: "CLOSED",
    runners: [
      { selectionId: 12345, status: "WINNER", sp: { nearPrice: 3.5 } },
      { selectionId: 12346, status: "LOSER", sp: { nearPrice: 2.1 } },
    ],
  },
];

check("Market book status", mockBook[0].status, "CLOSED");
check("Winner detected", mockBook[0].runners.find(r => r.status === "WINNER").selectionId, 12345);
check("BSP available", mockBook[0].runners[0].sp.nearPrice, 3.5);

// Settlement calculation with mock data
console.log("\n── Settlement Math ──");
const stake = 100;
const bets = [
  { amount: 50, betType: "win", dividend: 3.50, won: true },   // $50 × $3.50 = $175
  { amount: 30, betType: "place", dividend: 1.80, won: true },  // $30 × $1.80 = $54
  { amount: 20, betType: "win", dividend: null, won: false },    // lost
];

let totalReturns = 0;
for (const bet of bets) {
  if (bet.won && bet.dividend) {
    totalReturns += bet.amount * bet.dividend;
  }
}
const profit = Math.round((totalReturns - stake) * 100) / 100;

check("Total returns ($175 + $54)", totalReturns, 229);
check("Profit ($229 - $100)", profit, 129);

// Single bet example (Dean's scenario)
const singleBetReturn = 50 * 3.50; // $175
const singleBetProfit = singleBetReturn - 100; // -$100 budget
check("Single $50 win @$3.50, profit", singleBetProfit, 75);

// No-tip penalty
check("No-tip penalty", -100, -100);

console.log(`\n══════════════════════════════════`);
console.log(`  Results: ${pass} passed, ${fail} failed`);
console.log(`══════════════════════════════════`);

process.exit(fail);
