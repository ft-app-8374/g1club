// CJS exports of pure functions from betfair.ts for testing

function isGroup1Market(marketName) {
  return /Grp1/i.test(marketName);
}

function parseMarketName(marketName) {
  const raceMatch = marketName.match(/R(\d+)/);
  const distMatch = marketName.match(/(\d+)m/);
  const grade = /Grp1/i.test(marketName)
    ? "G1"
    : /Grp2/i.test(marketName)
      ? "G2"
      : /Grp3/i.test(marketName)
        ? "G3"
        : /Listed/i.test(marketName)
          ? "Listed"
          : "Other";

  return {
    raceNumber: raceMatch ? parseInt(raceMatch[1]) : null,
    distance: distMatch ? parseInt(distMatch[1]) : null,
    grade,
  };
}

module.exports = { isGroup1Market, parseMarketName };
