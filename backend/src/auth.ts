import type { Request, Response, NextFunction } from "express";
import { prisma } from "./prisma.js";

export async function currentUser(req: Request) {
  const player = String(req.header("x-mymemo-player") ?? "player-one").toLowerCase();
  const role = player === "israel" ? "ISRAEL" : "PLAYER_ONE";
  return prisma.user.findUniqueOrThrow({ where: { role } });
}

export async function requireIsrael(req: Request, res: Response, next: NextFunction) {
  const user = await currentUser(req);
  if (user.role !== "ISRAEL") {
    res.status(403).json({ message: "Somente Israel pode gerenciar recursos administrativos." });
    return;
  }
  next();
}
