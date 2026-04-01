const BETFAIR_API = "https://api.betfair.com/exchange/betting/rest/v1.0";
const BETFAIR_LOGIN = "https://identitysso.betfair.com.au/api/login";

let sessionToken: string | null = null;

function getAppKey(): string {
  const key = process.env.BETFAIR_APP_KEY || process.env.BETFAIR_API_KEY;
  if (!key) throw new Error("BETFAIR_APP_KEY not set");
  return key;
}

export async function betfairLogin(
  username?: string,
  password?: string
): Promise<string> {
  const user = username || process.env.BETFAIR_USERNAME;
  const pass = password || process.env.BETFAIR_PASSWORD;
  if (!user || !pass) {
    throw new Error("BETFAIR_USERNAME and BETFAIR_PASSWORD must be set");
  }

  const body = `username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`;
  const res = await fetch(BETFAIR_LOGIN, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
      "X-Application": getAppKey(),
    },
    body,
    redirect: "manual",
  });

  // Betfair returns 302 redirect on auth failure instead of JSON error
  if (res.status === 302) {
    const location = res.headers.get("location") || "";
    const errorMatch = location.match(/errorCode=(\w+)/);
    throw new Error(`Betfair login failed: ${errorMatch?.[1] || "redirect (possible auth failure)"}`);
  }

  if (!res.ok) {
    throw new Error(`Betfair login HTTP error: ${res.status}`);
  }

  const data = await res.json();
  if (data.status !== "SUCCESS") {
    throw new Error(`Betfair login failed: ${data.error || "unknown"}`);
  }

  sessionToken = data.token;
  return data.token;
}

export function setSessionToken(token: string) {
  sessionToken = token;
}

async function apiCall(endpoint: string, params: Record<string, unknown>) {
  if (!sessionToken) {
    throw new Error("Not authenticated with Betfair. Call betfairLogin first.");
  }

  const res = await fetch(`${BETFAIR_API}/${endpoint}/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Application": getAppKey(),
      "X-Authentication": sessionToken,
    },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Betfair API error (${res.status}): ${text}`);
  }

  return res.json();
}

export interface BetfairRunner {
  selectionId: number;
  runnerName: string;
  metadata?: {
    JOCKEY_NAME?: string;
    TRAINER_NAME?: string;
    WEIGHT_VALUE?: string;
    STALL_DRAW?: string;
    CLOTH_NUMBER?: string;
  };
  status?: string; // "ACTIVE" | "REMOVED" etc
  sp?: {
    nearPrice?: number;
  };
}

export interface BetfairMarket {
  marketId: string;
  marketName: string;
  marketStartTime: string;
  runners: BetfairRunner[];
  event?: {
    name: string;
    venue: string;
  };
  description?: {
    marketType: string;
  };
}

// Find Group 1 markets for a venue + date
export async function listMarketCatalogue(params: {
  venues?: string[];
  dateFrom: string;
  dateTo: string;
  marketTypes?: string[];
  maxResults?: number;
}): Promise<BetfairMarket[]> {
  const filter: Record<string, unknown> = {
    eventTypeIds: ["7"], // Horse racing
    marketCountries: ["AU"],
    marketTypeCodes: params.marketTypes || ["WIN"],
    marketStartTime: {
      from: params.dateFrom,
      to: params.dateTo,
    },
  };

  if (params.venues?.length) {
    filter.venues = params.venues;
  }

  return apiCall("listMarketCatalogue", {
    filter,
    marketProjection: [
      "RUNNER_METADATA",
      "MARKET_START_TIME",
      "EVENT",
      "MARKET_DESCRIPTION",
    ],
    maxResults: params.maxResults || 50,
    sort: "FIRST_TO_START",
  });
}

// Get market book (runner statuses, BSP)
export async function listMarketBook(params: {
  marketIds: string[];
  includeSP?: boolean;
}): Promise<
  Array<{
    marketId: string;
    status: string;
    runners: Array<{
      selectionId: number;
      status: string;
      sp?: { nearPrice?: number };
    }>;
  }>
> {
  const priceProjection = params.includeSP
    ? { priceData: ["SP_TRADED"] }
    : undefined;

  return apiCall("listMarketBook", {
    marketIds: params.marketIds,
    priceProjection,
  });
}

// Parse market name to detect Group 1
export function isGroup1Market(marketName: string): boolean {
  return /Grp1/i.test(marketName);
}

// Extract race info from market name (e.g. "R7 3200m Grp1")
export function parseMarketName(marketName: string): {
  raceNumber: number | null;
  distance: number | null;
  grade: string;
} {
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
