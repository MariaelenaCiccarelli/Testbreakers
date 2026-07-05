import express from 'express';
import { LeaderboardController } from '../controllers/LeaderboardController.js';

export const leaderboardRouter = express.Router();

leaderboardRouter.get("/leaderboards", LeaderboardController.getLeaderboards);