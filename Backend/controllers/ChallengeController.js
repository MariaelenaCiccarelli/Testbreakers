import { Challenge } from "../models/Database.js";

export class ChallengeController {
    // Restituisce tutte le sfide per la select del frontend
    static async getAllChallenges(req, res) {
        try {
            const challenges = await Challenge.findAll({
                attributes: ['challengeId', 'title', 'description', 'time']
            });
            return res.json(challenges);
        } catch (err) {
            console.error("Error retrieving Challenges:", err);
            return res.status(500).json({ error: "Error loading Challenges." });
        }
    }
}