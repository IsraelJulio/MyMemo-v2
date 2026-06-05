import type { Direction, GameMode } from "@prisma/client";
import { prisma } from "./prisma.js";

export const achievements = [
  { id: "first-game", title: "Primeiro Jogo", description: "Conclua sua primeira sessao." },
  { id: "marathoner", title: "Maratonista", description: "Jogue 7 dias seguidos." },
  { id: "perfect", title: "Perfeicao", description: "Acerte 100% em uma lista." },
  { id: "centurion", title: "Centuriao", description: "Acumule 100 pontos no total." },
  { id: "legend", title: "Lenda", description: "Acumule 1000 pontos no total." },
  { id: "unstoppable", title: "Imparavel", description: "Faca 10 acertos seguidos numa sessao." },
  { id: "importer", title: "Importador", description: "Importe sua primeira lista via CSV." },
  { id: "reviewer", title: "Revisor", description: "Conclua uma sessao de Spaced Repetition." },
  { id: "ambidextrous", title: "Ambidestro", description: "Jogue pela frente e pelo verso." },
  { id: "explorer", title: "Explorador", description: "Jogue 5 listas diferentes." },
  { id: "owl", title: "Coruja", description: "Jogue depois da meia-noite." },
  { id: "goal-hit", title: "Meta Batida", description: "Atinja uma meta de porcentagem definida." }
];

function isSpaced(mode: GameMode) {
  return mode === "SPACED_LIST" || mode === "SPACED_GLOBAL" || mode === "SPACED_LIST_WRITTEN" || mode === "SPACED_GLOBAL_WRITTEN";
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function hasSevenDayStreak(dates: Date[]) {
  const days = [...new Set(dates.map(dayKey))].sort();
  let streak = 1;
  for (let i = 1; i < days.length; i += 1) {
    const prev = new Date(`${days[i - 1]}T00:00:00.000Z`).getTime();
    const curr = new Date(`${days[i]}T00:00:00.000Z`).getTime();
    streak = curr - prev === 86_400_000 ? streak + 1 : 1;
    if (streak >= 7) return true;
  }
  return false;
}

export async function unlockForImport(userId: string) {
  await prisma.achievementUnlock.upsert({
    where: { userId_achievementId: { userId, achievementId: "importer" } },
    update: {},
    create: { userId, achievementId: "importer" }
  });
}

export async function evaluateAchievements(userId: string, session?: { mode: GameMode; direction: Direction; accuracy: number; longestStreak: number; playedAt: Date }) {
  const sessions = await prisma.gameSession.findMany({ where: { userId }, orderBy: { playedAt: "asc" } });
  const totalPoints = sessions.reduce((sum, row) => sum + row.points, 0);
  const directions = new Set(sessions.map((row) => row.direction));
  const listCount = new Set(sessions.map((row) => row.listTitle)).size;
  const goalsHit = await prisma.goal.count({ where: { userId, achievedAt: { not: null } } });
  const candidates = new Set<string>();

  if (sessions.length > 0) candidates.add("first-game");
  if (hasSevenDayStreak(sessions.map((row) => row.playedAt))) candidates.add("marathoner");
  if (sessions.some((row) => row.accuracy === 100)) candidates.add("perfect");
  if (totalPoints >= 100) candidates.add("centurion");
  if (totalPoints >= 1000) candidates.add("legend");
  if (sessions.some((row) => row.longestStreak >= 10)) candidates.add("unstoppable");
  if (sessions.some((row) => isSpaced(row.mode))) candidates.add("reviewer");
  if (directions.has("FRONT") && directions.has("BACK")) candidates.add("ambidextrous");
  if (listCount >= 5) candidates.add("explorer");
  if (sessions.some((row) => row.playedAt.getHours() === 0)) candidates.add("owl");
  if (goalsHit > 0) candidates.add("goal-hit");
  if (session?.longestStreak && session.longestStreak >= 10) candidates.add("unstoppable");

  const created = [];
  for (const achievementId of candidates) {
    const unlock = await prisma.achievementUnlock.upsert({
      where: { userId_achievementId: { userId, achievementId } },
      update: {},
      create: { userId, achievementId }
    });
    created.push(unlock);
  }
  return created;
}
