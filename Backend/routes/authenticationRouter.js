import express from "express";
import { AuthController } from "../controllers/AuthController.js";

export const authenticationRouter = express.Router();

authenticationRouter.post("/auth", AuthController.login);
authenticationRouter.post("/signup", AuthController.signup);

// Rotta per recuperare gli avatar (lato Frontend) dal Backend
authenticationRouter.get("/available-avatars", AuthController.getAvailableAvatars);