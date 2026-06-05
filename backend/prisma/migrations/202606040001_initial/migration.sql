CREATE TYPE "Role" AS ENUM ('PLAYER_ONE', 'ISRAEL');
CREATE TYPE "Direction" AS ENUM ('FRONT', 'BACK');
CREATE TYPE "GameMode" AS ENUM ('BASE', 'SPACED_LIST', 'SPACED_GLOBAL', 'BASE_WRITTEN', 'SPACED_LIST_WRITTEN', 'SPACED_GLOBAL_WRITTEN');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "role" "Role" NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StudyList" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "color" TEXT NOT NULL DEFAULT '#7c3aed',
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudyList_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Card" (
  "id" TEXT NOT NULL,
  "listId" TEXT NOT NULL,
  "front" TEXT NOT NULL,
  "back" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Attempt" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "cardId" TEXT NOT NULL,
  "sessionId" TEXT,
  "direction" "Direction" NOT NULL,
  "correct" BOOLEAN NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GameSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "listId" TEXT,
  "listTitle" TEXT NOT NULL,
  "mode" "GameMode" NOT NULL,
  "direction" "Direction" NOT NULL,
  "points" DOUBLE PRECISION NOT NULL,
  "accuracy" DOUBLE PRECISION NOT NULL,
  "correctCount" INTEGER NOT NULL,
  "totalCount" INTEGER NOT NULL,
  "longestStreak" INTEGER NOT NULL,
  "antiGrind" BOOLEAN NOT NULL DEFAULT false,
  "playedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Goal" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "listId" TEXT,
  "target" DOUBLE PRECISION NOT NULL,
  "achievedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AchievementUnlock" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "achievementId" TEXT NOT NULL,
  "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AchievementUnlock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_displayName_key" ON "User"("displayName");
CREATE UNIQUE INDEX "User_role_key" ON "User"("role");
CREATE UNIQUE INDEX "AchievementUnlock_userId_achievementId_key" ON "AchievementUnlock"("userId", "achievementId");

ALTER TABLE "Card" ADD CONSTRAINT "Card_listId_fkey" FOREIGN KEY ("listId") REFERENCES "StudyList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_listId_fkey" FOREIGN KEY ("listId") REFERENCES "StudyList"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_listId_fkey" FOREIGN KEY ("listId") REFERENCES "StudyList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AchievementUnlock" ADD CONSTRAINT "AchievementUnlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
