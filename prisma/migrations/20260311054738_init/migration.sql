-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "isFinancial" BOOLEAN NOT NULL DEFAULT false,
    "inviteCodeUsed" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "InviteCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "usedBy" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InviteCode_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InviteCode_usedBy_fkey" FOREIGN KEY ("usedBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Carnival" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "entryFee" REAL NOT NULL DEFAULT 55.0,
    "status" TEXT NOT NULL DEFAULT 'upcoming',
    "prizeConfig" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Round" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "carnivalId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "raceDate" DATETIME NOT NULL,
    "cutoffAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'upcoming',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Round_carnivalId_fkey" FOREIGN KEY ("carnivalId") REFERENCES "Carnival" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Race" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roundId" TEXT NOT NULL,
    "betfairMarketId" TEXT,
    "betfairPlaceMarketId" TEXT,
    "name" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "distance" INTEGER NOT NULL,
    "raceTime" DATETIME NOT NULL,
    "raceNumber" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'upcoming',
    "numPlacePositions" INTEGER NOT NULL DEFAULT 3,
    "grade" TEXT NOT NULL DEFAULT 'G1',
    "prizePool" TEXT,
    "raceType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" DATETIME,
    CONSTRAINT "Race_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Runner" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "raceId" TEXT NOT NULL,
    "betfairRunnerId" TEXT,
    "name" TEXT NOT NULL,
    "barrier" INTEGER,
    "jockey" TEXT,
    "trainer" TEXT,
    "weight" REAL,
    "isScratched" BOOLEAN NOT NULL DEFAULT false,
    "scratchedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Runner_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Result" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "raceId" TEXT NOT NULL,
    "runnerId" TEXT NOT NULL,
    "finishPosition" INTEGER NOT NULL,
    "winDividend" REAL,
    "placeDividend" REAL,
    "isDeadHeat" BOOLEAN NOT NULL DEFAULT false,
    "deadHeatFactor" REAL NOT NULL DEFAULT 1.0,
    "isProtest" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'betfair',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Result_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Result_runnerId_fkey" FOREIGN KEY ("runnerId") REFERENCES "Runner" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tip" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Tip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Tip_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TipLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tipId" TEXT NOT NULL,
    "runnerId" TEXT NOT NULL,
    "backupRunnerId" TEXT,
    "betType" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "isBackupActive" BOOLEAN NOT NULL DEFAULT false,
    "effectiveRunnerId" TEXT,
    CONSTRAINT "TipLine_tipId_fkey" FOREIGN KEY ("tipId") REFERENCES "Tip" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TipLine_runnerId_fkey" FOREIGN KEY ("runnerId") REFERENCES "Runner" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TipLine_backupRunnerId_fkey" FOREIGN KEY ("backupRunnerId") REFERENCES "Runner" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TipLine_effectiveRunnerId_fkey" FOREIGN KEY ("effectiveRunnerId") REFERENCES "Runner" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Ledger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "tipId" TEXT,
    "stake" REAL NOT NULL DEFAULT -100.0,
    "returns" REAL NOT NULL DEFAULT 0.0,
    "profit" REAL NOT NULL DEFAULT -100.0,
    "breakdown" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Ledger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Ledger_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Ledger_tipId_fkey" FOREIGN KEY ("tipId") REFERENCES "Tip" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HonourRoll" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "carnivalId" TEXT,
    "year" INTEGER NOT NULL,
    "winnerName" TEXT NOT NULL,
    "winnerProfit" REAL NOT NULL,
    "runnerUpName" TEXT,
    "runnerUpProfit" REAL,
    "thirdName" TEXT,
    "thirdProfit" REAL,
    "woodenSpoonName" TEXT,
    "woodenSpoonProfit" REAL,
    "entrants" INTEGER,
    "races" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HonourRoll_carnivalId_fkey" FOREIGN KEY ("carnivalId") REFERENCES "Carnival" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "keys" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "InviteCode_code_key" ON "InviteCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "InviteCode_usedBy_key" ON "InviteCode"("usedBy");

-- CreateIndex
CREATE UNIQUE INDEX "Carnival_year_key" ON "Carnival"("year");

-- CreateIndex
CREATE UNIQUE INDEX "Round_carnivalId_number_key" ON "Round"("carnivalId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Runner_raceId_name_key" ON "Runner"("raceId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Result_raceId_runnerId_key" ON "Result"("raceId", "runnerId");

-- CreateIndex
CREATE UNIQUE INDEX "Tip_userId_raceId_key" ON "Tip"("userId", "raceId");

-- CreateIndex
CREATE UNIQUE INDEX "Ledger_userId_raceId_key" ON "Ledger"("userId", "raceId");

-- CreateIndex
CREATE UNIQUE INDEX "HonourRoll_year_key" ON "HonourRoll"("year");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");
