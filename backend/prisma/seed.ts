import { PrismaClient, Direction, GameMode } from "@prisma/client";
import { scoreAnswers } from "../src/scoring.js";
import { evaluateAchievements } from "../src/achievements.js";

const prisma = new PrismaClient();

const sampleLists = [
  {
    title: "Ingles essencial",
    color: "#22c55e",
    cards: [
      ["To improve", "Melhorar"],
      ["Although", "Embora"],
      ["Reliable", "Confiavel"],
      ["Achievement", "Conquista"],
      ["To wonder", "Perguntar-se"]
    ]
  },
  {
    title: "Conceitos de SQL",
    color: "#0ea5e9",
    cards: [
      ["SELECT", "Consulta dados de uma tabela"],
      ["JOIN", "Combina linhas de tabelas relacionadas"],
      ["INDEX", "Estrutura para acelerar consultas"],
      ["TRANSACTION", "Unidade atomica de trabalho"],
      ["FOREIGN KEY", "Chave que referencia outra tabela"]
    ]
  },
  {
    title: "Historia rapida",
    color: "#f97316",
    cards: [
      ["Independencia do Brasil", "1822"],
      ["Queda de Constantinopla", "1453"],
      ["Revolucao Francesa", "1789"],
      ["Primeira Guerra Mundial", "1914-1918"],
      ["Constituicao brasileira atual", "1988"]
    ]
  }
];

async function makeSession(userId: string, listId: string, listTitle: string, mode: GameMode, direction: Direction, pattern: boolean[], daysAgo: number) {
  const cards = await prisma.card.findMany({ where: { listId } });
  const answers = pattern.map((correct, index) => ({ cardId: cards[index % cards.length].id, correct }));
  const score = scoreAnswers(answers, false);
  const playedAt = new Date(Date.now() - daysAgo * 86_400_000);
  const session = await prisma.gameSession.create({
    data: {
      userId,
      listId,
      listTitle,
      mode,
      direction,
      playedAt,
      ...score,
      totalCount: answers.length,
      attempts: { create: answers.map((answer) => ({ userId, cardId: answer.cardId, direction, correct: answer.correct, createdAt: playedAt })) }
    }
  });
  await evaluateAchievements(userId, session);
}

async function main() {
  await prisma.achievementUnlock.deleteMany();
  await prisma.attempt.deleteMany();
  await prisma.gameSession.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.card.deleteMany();
  await prisma.studyList.deleteMany();
  await prisma.user.deleteMany();

  const playerOne = await prisma.user.create({ data: { displayName: "Player One", role: "PLAYER_ONE" } });
  const israel = await prisma.user.create({ data: { displayName: "Israel", role: "ISRAEL" } });

  const createdLists = [];
  for (const item of sampleLists) {
    createdLists.push(await prisma.studyList.create({
      data: {
        title: item.title,
        color: item.color,
        cards: { create: item.cards.map(([front, back]) => ({ front, back })) }
      }
    }));
  }

  await makeSession(playerOne.id, createdLists[0].id, createdLists[0].title, "BASE", "FRONT", [true, true, false, true, false], 4);
  await makeSession(israel.id, createdLists[0].id, createdLists[0].title, "BASE_WRITTEN", "BACK", [true, true, true, true, true], 3);
  await makeSession(israel.id, createdLists[1].id, createdLists[1].title, "SPACED_LIST", "FRONT", [false, true, false, true, true], 2);
  await makeSession(playerOne.id, createdLists[2].id, createdLists[2].title, "BASE", "BACK", [true, false, true, false, true], 1);

  await prisma.goal.create({ data: { userId: israel.id, target: 85 } });
  await prisma.goal.create({ data: { userId: israel.id, listId: createdLists[0].id, target: 90, achievedAt: new Date(Date.now() - 3 * 86_400_000) } });
  await evaluateAchievements(israel.id);
  await evaluateAchievements(playerOne.id);
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
