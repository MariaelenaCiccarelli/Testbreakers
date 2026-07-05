import express from 'express';
import { MatchController } from '../controllers/MatchController.js';
import { optionalAuth, enforceMatchToken } from '../middleware/authorization.js';

export const matchRouter = express.Router();

// Rotta per INIZIARE il match
// Usa optionalAuth per vedere se P1 è già loggato (token 24h)
matchRouter.post("/new-match", optionalAuth, MatchController.createMatch);

// Abbandono match
matchRouter.post("/:matchId/abandon", MatchController.abandonMatch);

// Recupera i dati della sfida (istruzioni, template, tempo)
// Protezione: enforceMatchToken (così solo chi sta giocando può vedere la sfida)
matchRouter.get("/match-arena/:matchId", enforceMatchToken, MatchController.getMatchChallenge);

// Submit del codice
matchRouter.post("/match-arena/:matchId/submit-turn", enforceMatchToken, MatchController.submitTurn);

