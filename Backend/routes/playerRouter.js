import express from "express";
import { PlayerController } from "../controllers/PlayerController.js";

export const playerRouter = new express.Router();

//recupero statistiche dei match
playerRouter.get("/player-infos", PlayerController.getPlayerInfo);
playerRouter.put("/update-avatar", PlayerController.updateAvatar);
playerRouter.get("/player-streak", PlayerController.getCurrentStreak);