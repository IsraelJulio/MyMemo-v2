import { prisma } from "./prisma.js";

export function streakMultiplier(streak: number) {
  if (streak >= 10) return 3;
  if (streak >= 5) return 2;
  if (streak >= 3) return 1.5;
  return 1;
}

export async function shouldApplyAntiGrind(userId: string, listId: string) {
  const last = await prisma.gameSession.findFirst({
    where: { userId, listId },
    orderBy: { playedAt: "desc" }
  });
  if (!last) return false;
  return Date.now() - last.playedAt.getTime() < 3 * 60 * 60 * 1000;
}

export function scoreAnswers(answers: { correct: boolean }[], antiGrind: boolean) {
  let streak = 0;
  let longestStreak = 0;
  let points = 0;
  let correctCount = 0;
  const base = antiGrind ? 0.5 : 1;
  const multiplierFactor = antiGrind ? 0.5 : 1;

  for (const answer of answers) {
    if (!answer.correct) {
      streak = 0;
      continue;
    }
    streak += 1;
    correctCount += 1;
    longestStreak = Math.max(longestStreak, streak);
    points += base * streakMultiplier(streak) * multiplierFactor;
  }

  return {
    points: Number(points.toFixed(2)),
    correctCount,
    longestStreak,
    accuracy: answers.length ? Number(((correctCount / answers.length) * 100).toFixed(1)) : 0
  };
}
