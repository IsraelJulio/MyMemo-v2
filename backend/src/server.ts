import "dotenv/config";
import cors from "cors";
import express from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { Direction, GameMode } from "@prisma/client";
import { currentUser, requireIsrael } from "./auth.js";
import { prisma } from "./prisma.js";
import { achievements, evaluateAchievements, unlockForImport } from "./achievements.js";
import { scoreAnswers, shouldApplyAntiGrind } from "./scoring.js";

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const port = Number(process.env.PORT ?? 4000);
const localOrigin = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origin === process.env.FRONTEND_ORIGIN || localOrigin.test(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("Origem nao permitida pelo CORS."));
  }
}));
app.use(express.json({ limit: "2mb" }));

function shuffle<T>(rows: T[]) {
  return rows.map((value) => ({ value, sort: Math.random() })).sort((a, b) => a.sort - b.sort).map(({ value }) => value);
}

function requireEnum<T extends Record<string, string>>(enumType: T, value: unknown) {
  if (typeof value !== "string" || !Object.values(enumType).includes(value)) throw new Error("Parametro invalido.");
  return value as T[keyof T];
}

function routeParam(value: string | string[] | undefined) {
  if (typeof value !== "string") throw new Error("Parametro de rota invalido.");
  return value;
}

async function spacedCards(userId: string, direction: Direction, listId?: string) {
  const attempts = await prisma.attempt.findMany({
    where: { userId, direction, card: listId ? { listId } : undefined, correct: false },
    include: { card: { include: { list: true } } },
    orderBy: { createdAt: "desc" }
  });
  const stats = new Map<string, { card: (typeof attempts)[number]["card"]; errors: number; total: number; lastError: Date }>();
  const allAttempts = await prisma.attempt.findMany({
    where: { userId, direction, cardId: { in: attempts.map((row) => row.cardId) } }
  });
  for (const row of attempts) {
    if (row.card.list.deletedAt) continue;
    const current = stats.get(row.cardId) ?? { card: row.card, errors: 0, total: 0, lastError: row.createdAt };
    current.errors += 1;
    current.lastError = current.lastError > row.createdAt ? current.lastError : row.createdAt;
    stats.set(row.cardId, current);
  }
  for (const row of allAttempts) {
    const current = stats.get(row.cardId);
    if (current) current.total += 1;
  }
  return [...stats.values()]
    .sort((a, b) => b.errors / b.total - a.errors / a.total || b.lastError.getTime() - a.lastError.getTime())
    .map((row) => row.card);
}

app.get("/api/me", async (req, res) => {
  res.json(await currentUser(req));
});

app.post("/api/login", async (req, res) => {
  if (req.body?.password !== "123") {
    res.status(401).json({ message: "Senha invalida." });
    return;
  }
  res.json(await prisma.user.findUniqueOrThrow({ where: { role: "ISRAEL" } }));
});

app.get("/api/lists", async (_req, res) => {
  const lists = await prisma.studyList.findMany({
    where: { deletedAt: null },
    include: { _count: { select: { cards: true } } },
    orderBy: { createdAt: "desc" }
  });
  res.json(lists);
});

app.get("/api/lists/:id", async (req, res) => {
  const list = await prisma.studyList.findFirst({
    where: { id: req.params.id, deletedAt: null },
    include: { cards: { orderBy: { createdAt: "asc" } } }
  });
  if (!list) res.status(404).json({ message: "Lista nao encontrada." });
  else res.json(list);
});

app.post("/api/lists", requireIsrael, async (req, res) => {
  const list = await prisma.studyList.create({
    data: {
      title: String(req.body.title ?? "Nova lista"),
      color: String(req.body.color ?? "#7c3aed"),
      cards: { create: (req.body.cards ?? []).filter(Boolean).map((card: { front: string; back: string }) => ({ front: card.front, back: card.back })) }
    },
    include: { cards: true, _count: { select: { cards: true } } }
  });
  res.status(201).json(list);
});

app.put("/api/lists/:id", requireIsrael, async (req, res) => {
  const id = routeParam(req.params.id);
  const list = await prisma.studyList.update({
    where: { id },
    data: { title: String(req.body.title), color: String(req.body.color ?? "#7c3aed") },
    include: { cards: true }
  });
  res.json(list);
});

app.delete("/api/lists/:id", requireIsrael, async (req, res) => {
  await prisma.studyList.update({ where: { id: routeParam(req.params.id) }, data: { deletedAt: new Date() } });
  res.status(204).end();
});

app.post("/api/lists/:id/cards", requireIsrael, async (req, res) => {
  const card = await prisma.card.create({
    data: { listId: routeParam(req.params.id), front: String(req.body.front), back: String(req.body.back) }
  });
  res.status(201).json(card);
});

app.put("/api/cards/:id", requireIsrael, async (req, res) => {
  const card = await prisma.card.update({
    where: { id: routeParam(req.params.id) },
    data: { front: String(req.body.front), back: String(req.body.back) }
  });
  res.json(card);
});

app.delete("/api/cards/:id", requireIsrael, async (req, res) => {
  await prisma.card.delete({ where: { id: routeParam(req.params.id) } });
  res.status(204).end();
});

app.post("/api/import", requireIsrael, upload.single("file"), async (req, res) => {
  const user = await currentUser(req);
  if (!req.file) {
    res.status(400).json({ message: "Envie um arquivo CSV." });
    return;
  }
  const rows = parse(req.file.buffer, { skip_empty_lines: true, trim: true });
  const cards = rows.filter((row: string[]) => row[0] && row[1]).map((row: string[]) => ({ front: row[0], back: row[1] }));
  const list = req.body.listId
    ? await prisma.studyList.update({ where: { id: req.body.listId }, data: { cards: { create: cards } }, include: { _count: { select: { cards: true } } } })
    : await prisma.studyList.create({ data: { title: String(req.body.title ?? "Lista importada"), color: String(req.body.color ?? "#06b6d4"), cards: { create: cards } }, include: { _count: { select: { cards: true } } } });
  await unlockForImport(user.id);
  res.json({ imported: cards.length, list });
});

app.get("/api/play/cards", async (req, res) => {
  const user = await currentUser(req);
  const mode = requireEnum(GameMode, req.query.mode);
  const direction = requireEnum(Direction, req.query.direction);
  const listId = typeof req.query.listId === "string" ? req.query.listId : undefined;
  const isGlobal = mode === "SPACED_GLOBAL" || mode === "SPACED_GLOBAL_WRITTEN";
  const isSpaced = mode !== "BASE" && mode !== "BASE_WRITTEN";
  const cards = isSpaced
    ? await spacedCards(user.id, direction, isGlobal ? undefined : listId)
    : await prisma.card.findMany({ where: { listId, list: { deletedAt: null } }, include: { list: true } });
  res.json(shuffle(cards).slice(0, 30));
});

app.post("/api/sessions", async (req, res) => {
  const user = await currentUser(req);
  const mode = requireEnum(GameMode, req.body.mode);
  const direction = requireEnum(Direction, req.body.direction);
  const answers: { cardId: string; correct: boolean }[] = (req.body.answers ?? []).map((row: { cardId: string; correct: boolean }) => ({ cardId: row.cardId, correct: Boolean(row.correct) }));
  if (!answers.length) {
    res.status(400).json({ message: "A sessao precisa ter ao menos uma resposta." });
    return;
  }
  const firstCard = await prisma.card.findUniqueOrThrow({ where: { id: answers[0].cardId }, include: { list: true } });
  const listId = String(req.body.listId ?? firstCard.listId);
  const listTitle = String(req.body.listTitle ?? firstCard.list.title);
  const antiGrind = await shouldApplyAntiGrind(user.id, listId);
  const score = scoreAnswers(answers, antiGrind);
  const session = await prisma.gameSession.create({
    data: {
      userId: user.id,
      listId,
      listTitle,
      mode,
      direction,
      antiGrind,
      ...score,
      totalCount: answers.length,
      attempts: { create: answers.map((answer) => ({ userId: user.id, cardId: answer.cardId, direction, correct: answer.correct })) }
    }
  });
  await prisma.goal.updateMany({
    where: { userId: user.id, OR: [{ listId }, { listId: null }], achievedAt: null, target: { lte: score.accuracy } },
    data: { achievedAt: new Date() }
  });
  const unlocked = await evaluateAchievements(user.id, session);
  res.status(201).json({ session, unlocked });
});

app.get("/api/dashboard", async (req, res) => {
  const [sessions, users, lists, goals, unlocks] = await Promise.all([
    prisma.gameSession.findMany({ include: { user: true }, orderBy: { playedAt: "desc" }, take: 200 }),
    prisma.user.findMany(),
    prisma.studyList.findMany({ where: { deletedAt: null }, orderBy: { title: "asc" } }),
    prisma.goal.findMany({ include: { list: true, user: true }, orderBy: { createdAt: "desc" } }),
    prisma.achievementUnlock.findMany()
  ]);
  const byDirection = ["FRONT", "BACK"].map((direction) => {
    const rows = sessions.filter((row) => row.direction === direction);
    const total = rows.reduce((sum, row) => sum + row.totalCount, 0);
    const correct = rows.reduce((sum, row) => sum + row.correctCount, 0);
    return {
      direction,
      points: Number(rows.reduce((sum, row) => sum + row.points, 0).toFixed(2)),
      accuracy: total ? Number(((correct / total) * 100).toFixed(1)) : 0
    };
  });
  const days = new Map<string, { sessions: number; points: number; correct: number; total: number }>();
  for (const row of sessions) {
    const key = row.playedAt.toISOString().slice(0, 10);
    const current = days.get(key) ?? { sessions: 0, points: 0, correct: 0, total: 0 };
    current.sessions += 1;
    current.points += row.points;
    current.correct += row.correctCount;
    current.total += row.totalCount;
    days.set(key, current);
  }
  res.json({
    users,
    lists,
    sessions,
    stats: byDirection,
    calendar: [...days.entries()].map(([date, value]) => ({ date, ...value, accuracy: value.total ? Number(((value.correct / value.total) * 100).toFixed(1)) : 0 })),
    achievements,
    unlocks,
    goals
  });
});

app.post("/api/goals", requireIsrael, async (req, res) => {
  const user = await currentUser(req);
  const goal = await prisma.goal.create({
    data: { userId: user.id, listId: req.body.listId || null, target: Number(req.body.target) }
  });
  res.status(201).json(goal);
});

app.listen(port, () => {
  console.log(`MyMemo API running on http://localhost:${port}`);
});
