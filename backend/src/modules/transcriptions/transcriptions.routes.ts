import type { Express, NextFunction, Request, Response } from "express";
import { currentUser, requireIsrael } from "../../auth.js";
import {
  createListFromTranscription,
  createTranscriptionJob,
  getTranscriptionJob,
  listTranscriptBlocks,
  listTranscriptionJobs,
  updateTranscriptBlock
} from "./transcriptions.service.js";
import { TranscriptionRequestError } from "./transcriptions.validation.js";

type RouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

export function registerTranscriptionRoutes(app: Express) {
  app.post("/api/transcription-jobs", requireIsrael, route(async (req, res) => {
    const user = await currentUser(req);
    const job = await createTranscriptionJob(user.id, req.body ?? {});
    res.status(201).json(job);
  }));

  app.get("/api/transcription-jobs", route(async (req, res) => {
    const user = await currentUser(req);
    res.json(await listTranscriptionJobs(user.id));
  }));

  app.get("/api/transcription-jobs/:id", route(async (req, res) => {
    const user = await currentUser(req);
    res.json(await getTranscriptionJob(user.id, routeParam(req.params.id)));
  }));

  app.get("/api/transcription-jobs/:id/blocks", route(async (req, res) => {
    const user = await currentUser(req);
    res.json(await listTranscriptBlocks(user.id, routeParam(req.params.id)));
  }));

  app.put("/api/transcription-blocks/:id", requireIsrael, route(async (req, res) => {
    const user = await currentUser(req);
    res.json(await updateTranscriptBlock(user.id, routeParam(req.params.id), req.body ?? {}));
  }));

  app.post("/api/transcription-jobs/:id/create-list", requireIsrael, route(async (req, res) => {
    const user = await currentUser(req);
    const result = await createListFromTranscription(user.id, routeParam(req.params.id), req.body ?? {});
    res.status(201).json(result);
  }));
}

function route(handler: RouteHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch((error: unknown) => {
      if (error instanceof TranscriptionRequestError) {
        res.status(error.status).json({ message: error.message });
        return;
      }

      console.error("Transcription route failed", error);
      res.status(500).json({ message: "Nao foi possivel processar a transcricao agora." });
    });
  };
}

function routeParam(value: string | string[] | undefined) {
  if (typeof value !== "string" || !value) {
    throw new TranscriptionRequestError(400, "Parametro de rota invalido.");
  }
  return value;
}
