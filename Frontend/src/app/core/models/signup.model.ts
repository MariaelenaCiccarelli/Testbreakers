import { AuthRequest } from "./auth.model";

export interface SignupRequest extends AuthRequest {
  avatar: string;
}

export interface SignupResponse {
  playerId: number;
  handle: string;
  avatar: string;
  coderWins: number;
  testerWins: number;
  totalWins: number;
  matchesDone: number;
  bestStreak: number;
  actualStreak: number;
  createdAt: string; // Le date in JSON arrivano come stringhe ISO
  updatedAt: string;
}
