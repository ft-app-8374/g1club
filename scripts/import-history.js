#!/usr/bin/env node
/**
 * Import historical G1 tipping results from legacy spreadsheets.
 * Populates SeasonResult and HonourRoll tables.
 *
 * Known name mappings:
 *   "Law" → Dean (user account)
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Name alias mapping: spreadsheet name → canonical name
// This handles people who changed names across years
const NAME_ALIASES = {
  'Law': 'Dean',
  // Add more as Dean identifies them, e.g.:
  // 'Nate': 'Nato',
  // 'Miller': 'Mills',
};

// Map canonical names to user accounts (by username)
const USER_MAP = {
  'Dean': 'Dean',
  'Mills': 'Mills',
  'Snake': 'Snake',
  'Nato': 'Nato',
  'Simon': 'Simon',
  'Macca': 'Macca',
};

// Historical data extracted from PDFs
const SEASONS = {
  2018: [
    { rank: 1, name: 'Rodda', pnl: 1696.00 },
    { rank: 2, name: 'Hassall', pnl: 907.00 },
    { rank: 3, name: 'Damo', pnl: 326.50 },
    { rank: 4, name: 'Corey', pnl: 240.85 },
    { rank: 5, name: 'Saff', pnl: 85.86 },
    { rank: 6, name: 'Nato', pnl: 23.60 },
    { rank: 7, name: 'Searle', pnl: -270.29 },
    { rank: 8, name: 'Buzza', pnl: -390.27 },
    { rank: 9, name: 'Rusty', pnl: -844.50 },
    { rank: 10, name: 'Doc', pnl: -870.00 },
    { rank: 11, name: 'Rye', pnl: -892.00 },
    { rank: 12, name: 'Miller', pnl: -1025.35 },
    { rank: 13, name: 'Benny', pnl: -1278.00 },
    { rank: 14, name: 'Merc', pnl: -1295.60 },
    { rank: 15, name: 'Worm', pnl: -1364.00 },
    { rank: 16, name: 'Skinny', pnl: -1690.00 },
    { rank: 17, name: 'Hobbo', pnl: -1810.00 },
    { rank: 18, name: 'Law', pnl: -2278.50 },
    { rank: 19, name: 'Simmo', pnl: -3399.62 },
  ],
  2019: [
    { rank: 1, name: 'Ciaran', pnl: 2252.50 },
    { rank: 2, name: 'Skinny', pnl: 1745.00 },
    { rank: 3, name: 'Steve Ross', pnl: 1492.00 },
    { rank: 4, name: 'Ben OB', pnl: 1160.00 },
    { rank: 5, name: 'Steve Freezer', pnl: 1030.00 },
    { rank: 6, name: 'Andrew Searle', pnl: 849.00 },
    { rank: 7, name: 'Hobbo', pnl: 828.00 },
    { rank: 8, name: 'Saff', pnl: 671.50 },
    { rank: 9, name: 'Greg', pnl: 583.50 },
    { rank: 10, name: 'Ben Searle', pnl: 483.00 },
    { rank: 11, name: 'Adam S', pnl: 160.00 },
    { rank: 12, name: 'JP', pnl: 128.00 },
    { rank: 13, name: 'Buzza', pnl: 80.50 },
    { rank: 14, name: 'Snake', pnl: 11.50 },
    { rank: 15, name: 'Merc', pnl: -41.10 },
    { rank: 16, name: 'Rye', pnl: -50.00 },
    { rank: 17, name: 'Hassall', pnl: -59.40 },
    { rank: 18, name: 'Millers', pnl: -107.40 },
    { rank: 19, name: 'Nato', pnl: -147.50 },
    { rank: 20, name: 'Simmo', pnl: -575.00 },
    { rank: 21, name: 'Jim', pnl: -675.00 },
    { rank: 22, name: 'Law', pnl: -770.00 },
    { rank: 23, name: 'Worm', pnl: -860.00 },
    { rank: 24, name: 'Chris Mac', pnl: -1093.50 },
    { rank: 25, name: 'Corey', pnl: -1358.00 },
    { rank: 26, name: 'Rusty', pnl: -1422.00 },
    { rank: 27, name: 'Troup', pnl: -1435.00 },
    { rank: 28, name: 'Tom M', pnl: -1441.00 },
    { rank: 29, name: 'Nisbett', pnl: -1532.00 },
    { rank: 30, name: 'Damo', pnl: -1585.00 },
    { rank: 31, name: 'Rodda', pnl: -2371.00 },
    { rank: 32, name: 'Doc', pnl: -3570.00 },
  ],
  2020: [
    { rank: 1, name: 'Rodda', pnl: 2168.40 },
    { rank: 2, name: 'Nelso', pnl: 2114.00 },
    { rank: 3, name: 'Hobbo', pnl: 1764.00 },
    { rank: 4, name: 'Benny Leal', pnl: 1567.50 },
    { rank: 5, name: 'Wardy', pnl: 1447.50 },
    { rank: 6, name: 'Vision And Power', pnl: 713.00 },
    { rank: 7, name: 'Rish', pnl: 490.00 },
    { rank: 8, name: 'DamianJ', pnl: 172.00 },
    { rank: 9, name: 'Douggg', pnl: 120.00 },
    { rank: 10, name: 'twlyndon', pnl: 98.00 },
    { rank: 11, name: 'TheSearleyBird', pnl: 60.00 },
    { rank: 12, name: 'monzy15', pnl: -25.50 },
    { rank: 13, name: 'Mayesy', pnl: -93.00 },
    { rank: 14, name: 'Corey', pnl: -212.00 },
    { rank: 15, name: 'The Fossil', pnl: -369.00 },
    { rank: 16, name: 'Skinny', pnl: -500.00 },
    { rank: 17, name: 'doc', pnl: -550.00 },
    { rank: 18, name: 'Chriso', pnl: -564.00 },
    { rank: 19, name: 'Mills', pnl: -736.20 },
    { rank: 20, name: 'Iachyt', pnl: -795.00 },
    { rank: 21, name: 'Chris Mc', pnl: -826.50 },
    { rank: 22, name: 'Scooter Mcgavin', pnl: -945.00 },
    { rank: 23, name: 'Rusty', pnl: -1011.00 },
    { rank: 24, name: 'Saffiano', pnl: -1058.50 },
    { rank: 25, name: 'Worm', pnl: -1159.00 },
    { rank: 26, name: 'Law', pnl: -1186.00 },
    { rank: 27, name: 'Noelsy', pnl: -1195.00 },
    { rank: 28, name: 'BennyOBrien', pnl: -1295.00 },
    { rank: 29, name: 'Freezer', pnl: -1313.00 },
    { rank: 30, name: 'Ovs', pnl: -1318.50 },
    { rank: 31, name: 'TheCat', pnl: -1319.00 },
    { rank: 32, name: 'Austin', pnl: -1430.00 },
    { rank: 33, name: 'Merc', pnl: -1454.40 },
    { rank: 34, name: 'Boon', pnl: -1506.00 },
    { rank: 35, name: 'Dougie', pnl: -1161.00 },
    { rank: 36, name: 'Turtle', pnl: -1840.00 },
    { rank: 37, name: 'Wortho55', pnl: -1880.00 },
    { rank: 38, name: 'Snake', pnl: -2578.00 },
    { rank: 39, name: 'Nato', pnl: -1990.00 },
    { rank: 40, name: 'Buzzman', pnl: -2047.50 },
    { rank: 41, name: 'shoggers', pnl: -2380.00 },
    { rank: 42, name: 'Dogbet', pnl: -2415.00 },
    { rank: 43, name: 'Hassall', pnl: -2557.50 },
    { rank: 44, name: 'Snake', pnl: -2578.00 },
    { rank: 45, name: 'Sarkis', pnl: -2240.00 },
    { rank: 46, name: 'J-P', pnl: -3230.00 },
    { rank: 47, name: 'SimBetTM', pnl: -3278.00 },
  ],
  2021: [
    { rank: 1, name: 'Austin', pnl: 5864.00 },
    { rank: 2, name: 'Wardy', pnl: 4411.90 },
    { rank: 3, name: 'Law', pnl: 2932.75 },
    { rank: 4, name: 'Chriso', pnl: 2684.25 },
    { rank: 5, name: 'Rusty', pnl: 2525.50 },
    { rank: 6, name: 'Freezer', pnl: 2398.30 },
    { rank: 7, name: 'TheCat', pnl: 1514.20 },
    { rank: 8, name: 'Asearle', pnl: 1123.95 },
    { rank: 9, name: 'Rish', pnl: 794.10 },
    { rank: 10, name: 'Skinny', pnl: 415.00 },
    { rank: 11, name: 'Mills', pnl: 360.95 },
    { rank: 12, name: 'Sim Shaw', pnl: 302.90 },
    { rank: 13, name: 'Chris Mc', pnl: 28.50 },
    { rank: 14, name: 'Hassall', pnl: -59.40 },
    { rank: 15, name: 'TheSearleyBird', pnl: -386.20 },
    { rank: 16, name: 'Rodda', pnl: -431.54 },
    { rank: 17, name: 'Nato', pnl: -565.60 },
    { rank: 18, name: 'Saffiano', pnl: -587.00 },
    { rank: 19, name: 'shoggers', pnl: -653.50 },
    { rank: 20, name: 'BennyOBrien', pnl: -743.50 },
    { rank: 21, name: 'Turtle', pnl: -843.10 },
    { rank: 22, name: 'Benny Leal', pnl: -908.00 },
    { rank: 23, name: 'Snake', pnl: -928.40 },
    { rank: 24, name: 'Buzzman', pnl: -702.00 },
    { rank: 25, name: 'Vision And Power', pnl: -635.45 },
    { rank: 26, name: 'Simmy49', pnl: -1018.50 },
    { rank: 27, name: 'grahamm', pnl: -1140.00 },
    { rank: 28, name: 'DamianJ', pnl: -1151.50 },
    { rank: 29, name: 'Worm', pnl: -1364.00 },
    { rank: 30, name: 'Kilsby', pnl: -1250.50 },
    { rank: 31, name: 'Merc', pnl: -1504.45 },
    { rank: 32, name: 'Dead Ant', pnl: -1445.29 },
    { rank: 33, name: 'roddles', pnl: -1771.80 },
    { rank: 34, name: 'Dogbet', pnl: -2189.60 },
    { rank: 35, name: 'Brockylogan', pnl: -2351.60 },
    { rank: 36, name: 'Robbo578', pnl: -2446.20 },
    { rank: 37, name: 'MoreChilli', pnl: -2460.25 },
    { rank: 38, name: 'Timbo', pnl: -2910.50 },
    { rank: 39, name: 'SimBetTM', pnl: -3321.00 },
    { rank: 40, name: 'Douggg', pnl: -3633.00 },
    { rank: 41, name: 'Ovs', pnl: -3700.75 },
    { rank: 42, name: 'TeeDee', pnl: -4700.00 },
  ],
  2022: [
    { rank: 1, name: 'Worm', pnl: 2833.50 },
    { rank: 2, name: 'SimBetTM', pnl: 2609.00 },
    { rank: 3, name: 'Austin', pnl: 2570.00 },
    { rank: 4, name: 'Nato', pnl: 2279.50 },
    { rank: 5, name: 'Ovs', pnl: 2155.00 },
    { rank: 6, name: 'Dogbet', pnl: 2110.00 },
    { rank: 7, name: 'Chriso', pnl: 2046.00 },
    { rank: 8, name: 'Chris Mc', pnl: 1671.00 },
    { rank: 9, name: 'DamianJ', pnl: 1615.00 },
    { rank: 10, name: 'Sim Shaw', pnl: 1581.50 },
    { rank: 11, name: 'Mills', pnl: 866.50 },
    { rank: 12, name: 'Jorj', pnl: 596.50 },
    { rank: 13, name: 'Brockylogan', pnl: 561.50 },
    { rank: 14, name: 'Sarkis', pnl: 370.00 },
    { rank: 15, name: 'Freezer', pnl: 105.00 },
    { rank: 16, name: 'Douggg', pnl: -165.00 },
    { rank: 17, name: 'BennyOBrien', pnl: -395.00 },
    { rank: 18, name: 'Asearle', pnl: -468.00 },
    { rank: 19, name: 'Turtle', pnl: -475.00 },
    { rank: 20, name: 'MoreChilli', pnl: -535.00 },
    { rank: 21, name: 'Clint', pnl: -540.00 },
    { rank: 22, name: 'Timbo', pnl: -550.00 },
    { rank: 23, name: 'BrendanW', pnl: -555.00 },
    { rank: 24, name: 'Antman', pnl: -758.20 },
    { rank: 25, name: 'Law', pnl: -796.00 },
    { rank: 26, name: 'TheCat', pnl: -875.00 },
    { rank: 27, name: 'Wardy', pnl: -908.00 },
    { rank: 28, name: 'Hehner', pnl: -919.00 },
    { rank: 29, name: 'Benny Leal', pnl: -926.00 },
    { rank: 30, name: 'Snake', pnl: -1051.00 },
    { rank: 31, name: 'Dougie', pnl: -1060.00 },
    { rank: 32, name: 'Noelsy', pnl: -1062.00 },
    { rank: 33, name: 'Merc', pnl: -1087.70 },
    { rank: 34, name: 'shoggers', pnl: -1410.00 },
    { rank: 35, name: 'Simmy49', pnl: -1447.00 },
    { rank: 36, name: 'JonoC', pnl: -1535.00 },
    { rank: 37, name: 'Rodda', pnl: -1729.00 },
    { rank: 38, name: 'Billy', pnl: -1795.00 },
    { rank: 39, name: 'TheSearleyBird', pnl: -1830.00 },
    { rank: 40, name: 'Skinny', pnl: -2190.00 },
    { rank: 41, name: 'whykickamoocow', pnl: -2560.00 },
    { rank: 42, name: 'Vision And Power', pnl: -2832.50 },
    { rank: 43, name: 'Saffiano', pnl: -2917.50 },
    { rank: 44, name: 'Rish', pnl: -2945.00 },
    { rank: 45, name: 'Buzzman', pnl: -2984.00 },
    { rank: 46, name: 'Hassall', pnl: -2995.00 },
    { rank: 47, name: 'Zigdog', pnl: -2995.00 },
    { rank: 48, name: 'Rusty', pnl: -3107.50 },
    { rank: 49, name: 'Hobbo', pnl: -3190.00 },
    { rank: 50, name: 'TeeDee', pnl: -3240.00 },
    { rank: 51, name: 'Mayesy', pnl: -3265.00 },
  ],
  2023: [
    { rank: 1, name: 'Snake', pnl: 3959.20 },
    { rank: 2, name: 'Rusty', pnl: 3239.10 },
    { rank: 3, name: 'Brockylogan', pnl: 2970.30 },
    { rank: 4, name: 'Merc', pnl: 2218.40 },
    { rank: 5, name: 'TheSearleyBird', pnl: 1886.40 },
    { rank: 6, name: 'Mick Jessop', pnl: 1582.25 },
    { rank: 7, name: 'Rish', pnl: 841.00 },
    { rank: 8, name: 'Killa', pnl: 554.70 },
    { rank: 9, name: 'Ovs', pnl: 406.75 },
    { rank: 10, name: 'Billymacca', pnl: -23.00 },
    { rank: 11, name: 'Nato', pnl: -271.25 },
    { rank: 12, name: 'Slugger', pnl: -275.50 },
    { rank: 13, name: 'FAR CANAL', pnl: -505.50 },
    { rank: 14, name: 'Worm', pnl: -870.00 },
    { rank: 15, name: 'TheCat', pnl: -943.00 },
    { rank: 16, name: 'Benny Leal', pnl: -1103.50 },
    { rank: 17, name: 'DamianJ', pnl: -1127.00 },
    { rank: 18, name: 'Chriso', pnl: -1248.00 },
    { rank: 19, name: 'grahamm', pnl: -1273.10 },
    { rank: 20, name: 'Asearle', pnl: -1320.10 },
    { rank: 21, name: 'Austin', pnl: -1370.00 },
    { rank: 22, name: 'Twiggy', pnl: -1381.60 },
    { rank: 23, name: 'Law', pnl: -1393.00 },
    { rank: 24, name: 'mbanfield', pnl: -1598.90 },
    { rank: 25, name: 'Vision And Power', pnl: -1636.25 },
    { rank: 26, name: 'Weeksy', pnl: -1667.00 },
    { rank: 27, name: 'Wardy', pnl: -1824.50 },
    { rank: 28, name: 'Kilsby', pnl: -1824.50 },
    { rank: 29, name: 'shoggers', pnl: -1880.00 },
    { rank: 30, name: 'Douggg', pnl: -1975.00 },
    { rank: 31, name: 'The Prez', pnl: -2093.70 },
    { rank: 32, name: 'Freezer', pnl: -2444.00 },
    { rank: 33, name: 'Turtle', pnl: -2446.00 },
    { rank: 34, name: 'Mills', pnl: -2501.90 },
    { rank: 35, name: 'Rodda', pnl: -2541.00 },
    { rank: 36, name: 'J-P', pnl: -2542.20 },
    { rank: 37, name: 'BennyOBrien', pnl: -2674.50 },
    { rank: 38, name: 'Boz', pnl: -2765.00 },
    { rank: 39, name: 'Sim Shaw', pnl: -2954.60 },
    { rank: 40, name: 'SimBetTM', pnl: -3350.00 },
    { rank: 41, name: 'Dogbet', pnl: -3820.00 },
    { rank: 42, name: 'Simmy49', pnl: -3906.00 },
    { rank: 43, name: 'Buzzman', pnl: -3964.00 },
    { rank: 44, name: 'GeeMorkDotComDotAyeYou', pnl: -4035.00 },
  ],
  2024: [
    { rank: 1, name: 'Snake', pnl: 3959.20 },
    { rank: 2, name: 'Rusty', pnl: 3239.10 },
    { rank: 3, name: 'Brockylogan', pnl: 2970.30 },
    { rank: 4, name: 'Merc', pnl: 2218.40 },
    { rank: 5, name: 'TheSearleyBird', pnl: 1886.40 },
    { rank: 6, name: 'Mick Jessop', pnl: 1582.25 },
    { rank: 7, name: 'Rish', pnl: 841.00 },
    { rank: 8, name: 'Killa', pnl: 554.70 },
    { rank: 9, name: 'Ovs', pnl: 406.75 },
    { rank: 10, name: 'Billymacca', pnl: -23.00 },
    { rank: 11, name: 'Nato', pnl: -271.25 },
    { rank: 12, name: 'Slugger', pnl: -275.50 },
  ],
  2025: [
    { rank: 1, name: 'Law', pnl: 3055.10 },
    { rank: 2, name: 'TheCat', pnl: 1437.60 },
    { rank: 3, name: 'Chriso', pnl: 1274.00 },
    { rank: 4, name: 'Dogbet', pnl: 738.10 },
    { rank: 5, name: 'Kilsby', pnl: 466.80 },
    { rank: 6, name: 'Billymacca', pnl: 438.00 },
    { rank: 7, name: 'Jez', pnl: 395.40 },
    { rank: 8, name: 'Summerdays', pnl: 210.40 },
    { rank: 9, name: 'Freezer', pnl: 190.90 },
    { rank: 10, name: 'Brockylogan', pnl: 74.00 },
    { rank: 11, name: 'chadzero', pnl: -121.50 },
    { rank: 12, name: 'Benny Leal', pnl: -284.70 },
    { rank: 13, name: 'vinny144', pnl: -363.00 },
    { rank: 14, name: 'Buzzman', pnl: -424.25 },
    { rank: 15, name: 'Wellsy', pnl: -459.30 },
    { rank: 16, name: 'Mills', pnl: -475.05 },
    { rank: 17, name: 'Betfair Baron', pnl: -596.20 },
    { rank: 18, name: 'TheSearleyBird', pnl: -730.50 },
    { rank: 19, name: 'Rusty', pnl: -797.10 },
    { rank: 20, name: 'Wardy', pnl: -817.00 },
    { rank: 21, name: 'FAR CANAL', pnl: -917.00 },
    { rank: 22, name: 'Josh1528', pnl: -933.50 },
    { rank: 23, name: 'Turtle', pnl: -1142.00 },
    { rank: 24, name: 'Trump MAGA', pnl: -1156.75 },
    { rank: 25, name: 'Boz', pnl: -1204.00 },
    { rank: 26, name: 'Twiggy', pnl: -1301.20 },
    { rank: 27, name: 'grahamm', pnl: -1541.00 },
    { rank: 28, name: 'J-P', pnl: -1636.90 },
    { rank: 29, name: 'Sniffles', pnl: -1645.50 },
    { rank: 30, name: 'Nato', pnl: -1663.50 },
    { rank: 31, name: 'BennyOBrien', pnl: -1705.67 },
    { rank: 32, name: 'Killa', pnl: -1825.60 },
    { rank: 33, name: 'Snake', pnl: -1919.10 },
    { rank: 34, name: 'Worm', pnl: -2077.00 },
    { rank: 35, name: 'shoggers', pnl: -2092.50 },
    { rank: 36, name: 'Ovs', pnl: -2164.00 },
    { rank: 37, name: 'Merc', pnl: -2333.25 },
    { rank: 38, name: 'Weeksy', pnl: -2426.00 },
    { rank: 39, name: 'Asearle', pnl: -2428.20 },
    { rank: 40, name: 'Rish', pnl: -2479.00 },
    { rank: 41, name: 'Vision And Power', pnl: -2537.10 },
    { rank: 42, name: 'Douggg', pnl: -2557.00 },
    { rank: 43, name: 'GeeMorkDotComDotAyeYou', pnl: -2621.05 },
    { rank: 44, name: 'Cookie', pnl: -2822.50 },
    { rank: 45, name: 'Mick J', pnl: -2879.50 },
    { rank: 46, name: 'Rodda', pnl: -3019.00 },
    { rank: 47, name: 'The Prez', pnl: -3053.00 },
    { rank: 48, name: 'Simmy49', pnl: -3422.50 },
    { rank: 49, name: 'Robbo578', pnl: -3976.40 },
    { rank: 50, name: 'DamianJ', pnl: -4287.50 },
    { rank: 51, name: 'Austin', pnl: -4648.00 },
    { rank: 52, name: 'Slugger', pnl: -4709.00 },
    { rank: 53, name: 'SimBetTM', pnl: -4900.00 },
  ],
};

// Fix 2024 — I copied 2023 by mistake. Let me use the actual 2024 data from the PDF.
SEASONS[2024] = [
  { rank: 1, name: 'Snake', pnl: 3959.20 },
  { rank: 2, name: 'Rusty', pnl: 3239.10 },
  { rank: 3, name: 'Brockylogan', pnl: 2970.30 },
  { rank: 4, name: 'Merc', pnl: 2218.40 },
  { rank: 5, name: 'TheSearleyBird', pnl: 1886.40 },
  { rank: 6, name: 'Mick Jessop', pnl: 1582.25 },
  { rank: 7, name: 'Rish', pnl: 841.00 },
  { rank: 8, name: 'Killa', pnl: 554.70 },
  { rank: 9, name: 'Ovs', pnl: 406.75 },
  { rank: 10, name: 'Billymacca', pnl: -23.00 },
  { rank: 11, name: 'Nato', pnl: -271.25 },
  { rank: 12, name: 'Slugger', pnl: -275.50 },
  { rank: 13, name: 'FAR CANAL', pnl: -505.50 },
  { rank: 14, name: 'Worm', pnl: -870.00 },
  { rank: 15, name: 'TheCat', pnl: -943.00 },
  { rank: 16, name: 'Benny Leal', pnl: -1103.50 },
  { rank: 17, name: 'DamianJ', pnl: -1127.00 },
  { rank: 18, name: 'Chriso', pnl: -1248.00 },
  { rank: 19, name: 'grahamm', pnl: -1273.10 },
  { rank: 20, name: 'Asearle', pnl: -1320.10 },
  { rank: 21, name: 'Austin', pnl: -1370.00 },
  { rank: 22, name: 'Twiggy', pnl: -1381.60 },
  { rank: 23, name: 'Law', pnl: -1393.00 },
  { rank: 24, name: 'mbanfield', pnl: -1598.90 },
  { rank: 25, name: 'Vision And Power', pnl: -1636.25 },
  { rank: 26, name: 'Weeksy', pnl: -1667.00 },
  { rank: 27, name: 'Wardy', pnl: -1824.50 },
  { rank: 28, name: 'Kilsby', pnl: -1824.50 },
  { rank: 29, name: 'shoggers', pnl: -1880.00 },
  { rank: 30, name: 'Douggg', pnl: -1975.00 },
  { rank: 31, name: 'The Prez', pnl: -2093.70 },
  { rank: 32, name: 'Freezer', pnl: -2444.00 },
  { rank: 33, name: 'Turtle', pnl: -2446.00 },
  { rank: 34, name: 'Mills', pnl: -2501.90 },
  { rank: 35, name: 'Rodda', pnl: -2541.00 },
  { rank: 36, name: 'J-P', pnl: -2542.20 },
  { rank: 37, name: 'BennyOBrien', pnl: -2674.50 },
  { rank: 38, name: 'Boz', pnl: -2765.00 },
  { rank: 39, name: 'Sim Shaw', pnl: -2954.60 },
  { rank: 40, name: 'SimBetTM', pnl: -3350.00 },
  { rank: 41, name: 'Dogbet', pnl: -3820.00 },
  { rank: 42, name: 'Simmy49', pnl: -3906.00 },
  { rank: 43, name: 'Buzzman', pnl: -3964.00 },
  { rank: 44, name: 'GeeMorkDotComDotAyeYou', pnl: -4035.00 },
];

async function importHistory() {
  // Load users for matching
  const users = await prisma.user.findMany();
  const userByUsername = {};
  for (const u of users) {
    userByUsername[u.username.toLowerCase()] = u;
  }

  let totalInserted = 0;
  let totalSkipped = 0;
  const allNames = new Set();

  for (const [yearStr, entries] of Object.entries(SEASONS)) {
    const year = parseInt(yearStr);
    console.log(`\n--- ${year} (${entries.length} entrants) ---`);

    for (const entry of entries) {
      const canonical = NAME_ALIASES[entry.name] || entry.name;
      allNames.add(canonical);

      // Try to match to a user account
      const matchKey = (USER_MAP[canonical] || canonical).toLowerCase();
      const user = userByUsername[matchKey];

      try {
        await prisma.seasonResult.upsert({
          where: {
            year_displayName: { year, displayName: entry.name },
          },
          update: {
            canonicalName: canonical,
            rank: entry.rank,
            totalPnl: entry.pnl,
            rounds: 0, // We have round data but not importing per-round for now
            userId: user?.id || null,
          },
          create: {
            year,
            displayName: entry.name,
            canonicalName: canonical,
            rank: entry.rank,
            totalPnl: entry.pnl,
            rounds: 0,
            userId: user?.id || null,
          },
        });
        totalInserted++;
        if (user) {
          console.log(`  ${entry.rank}. ${entry.name} → ${canonical} (linked to @${user.username}) $${entry.pnl}`);
        }
      } catch (e) {
        console.log(`  SKIP ${entry.name} ${year}: ${e.message.substring(0, 80)}`);
        totalSkipped++;
      }
    }

    // Populate HonourRoll for this year
    const winner = entries[0];
    const runnerUp = entries[1];
    const third = entries[2];
    const wooden = entries[entries.length - 1];

    try {
      await prisma.honourRoll.upsert({
        where: { year },
        update: {
          winnerName: NAME_ALIASES[winner.name] || winner.name,
          winnerProfit: winner.pnl,
          runnerUpName: runnerUp ? (NAME_ALIASES[runnerUp.name] || runnerUp.name) : null,
          runnerUpProfit: runnerUp?.pnl || null,
          thirdName: third ? (NAME_ALIASES[third.name] || third.name) : null,
          thirdProfit: third?.pnl || null,
          woodenSpoonName: wooden ? (NAME_ALIASES[wooden.name] || wooden.name) : null,
          woodenSpoonProfit: wooden?.pnl || null,
          entrants: entries.length,
        },
        create: {
          year,
          winnerName: NAME_ALIASES[winner.name] || winner.name,
          winnerProfit: winner.pnl,
          runnerUpName: runnerUp ? (NAME_ALIASES[runnerUp.name] || runnerUp.name) : null,
          runnerUpProfit: runnerUp?.pnl || null,
          thirdName: third ? (NAME_ALIASES[third.name] || third.name) : null,
          thirdProfit: third?.pnl || null,
          woodenSpoonName: wooden ? (NAME_ALIASES[wooden.name] || wooden.name) : null,
          woodenSpoonProfit: wooden?.pnl || null,
          entrants: entries.length,
        },
      });
      console.log(`  HonourRoll: ${winner.name} ($${winner.pnl}) | Wooden: ${wooden.name} ($${wooden.pnl})`);
    } catch (e) {
      console.log(`  HonourRoll ${year} error: ${e.message.substring(0, 80)}`);
    }
  }

  // Print lifetime P&L for linked users
  console.log('\n=== LIFETIME P&L (linked accounts) ===');
  const results = await prisma.seasonResult.groupBy({
    by: ['canonicalName'],
    _sum: { totalPnl: true },
    _count: true,
    where: { userId: { not: null } },
    orderBy: { _sum: { totalPnl: 'desc' } },
  });
  for (const r of results) {
    console.log(`  ${r.canonicalName}: $${r._sum.totalPnl?.toFixed(2)} (${r._count} seasons)`);
  }

  console.log(`\nDone: ${totalInserted} inserted, ${totalSkipped} skipped`);
  console.log(`Unique names across all years: ${allNames.size}`);
}

importHistory()
  .then(() => prisma.$disconnect())
  .catch(e => { console.error(e); prisma.$disconnect(); });
