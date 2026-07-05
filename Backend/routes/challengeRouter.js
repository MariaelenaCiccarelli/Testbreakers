import express from 'express';
import { ChallengeController } from '../controllers/ChallengeController.js';

export const challengeRouter = express.Router();

challengeRouter.get("/challenges", ChallengeController.getAllChallenges);