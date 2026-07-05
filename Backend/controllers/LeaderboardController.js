import { Sequelize } from "sequelize";
import { Player } from "../models/Database.js";

export class LeaderboardController {

    static async getLeaderboards(req, res) {
        try {
            // Estrazione dal DB (Ordinamento preventivo Postgres)
            const globalQuery = await Player.findAll({
                attributes: ['playerId', 'handle', 'avatar', 'totalWins', 'matchesDone', 'actualStreak', 'bestStreak'],
                order: [
                    ['totalWins', 'DESC'],
                    [Sequelize.literal('(\"totalWins\" * 100.0 / NULLIF(\"matchesDone\", 0))'), 'DESC']
                ],
                limit: 15 // Estraiamo qualche elemento in più per garantire un ri-ordinamento accurato in memoria
            });

            const coderQuery = await Player.findAll({
                attributes: ['playerId', 'handle', 'avatar', 'coderWins', 'coderMatches', 'matchesDone'],
                order: [
                    ['coderWins', 'DESC'],
                    [Sequelize.literal('(\"coderWins\" * 100.0 / NULLIF(\"coderMatches\", 0))'), 'DESC']
                ],
                limit: 15
            });

            const testerQuery = await Player.findAll({
                attributes: ['playerId', 'handle', 'avatar', 'testerWins', 'testerMatches', 'matchesDone'],
                order: [
                    ['testerWins', 'DESC'],
                    [Sequelize.literal('(\"testerWins\" * 100.0 / NULLIF(\"testerMatches\", 0))'), 'DESC']
                ],
                limit: 15
            });

            // Helper di formattazione con calcolo MMR Logaritmico
            const processLeaderboard = (list, winField, matchesField) => {
                const formatted = list.map((player) => {
                    const wins = player.getDataValue(winField);
                    const roleMatches = player.getDataValue(matchesField);
                    
                    // Calcolo Win Rate % standard
                    const winRate = roleMatches > 0 ? parseFloat(((wins / roleMatches) * 100).toFixed(1)) : 0;

                    // Applicazione algoritmo
                    // Formula: (Wins * 5) + (WinRate * log10(Matches + 1) * 50)
                    const baseWinsScore = wins * 5;
                    const logFactor = Math.log10(roleMatches + 1);
                    const winRateBonus = winRate * logFactor * 50;
                    
                    // Punteggio MMR Finale arrotondato all'intero più vicino
                    const mmr = Math.round(baseWinsScore + winRateBonus);

                    return {
                        playerId: player.playerId,
                        handle: player.handle,
                        avatar: player.avatar,
                        wins: wins,
                        matchesDone: roleMatches,
                        winRate: winRate,
                        mmr: mmr, // Il punteggio combinato da mostrare
                        actualStreak: player.actualStreak || 0,
                        bestStreak: player.bestStreak || 0
                    };
                });

                // Ri-ordiniamo l'array in memoria basandoci rigorosamente sul valore MMR puro decrescente
                return formatted
                    .sort((a, b) => b.mmr - a.mmr)
                    .slice(0, 10) // Tagliamo la lista restituendo solo la Top 10 reale
                    .map((player, idx) => ({ ...player, position: idx + 1 })); // Assegniamo la posizione grafica (1-10)
            };

            return res.json({
                global: processLeaderboard(globalQuery, 'totalWins', 'matchesDone'),
                coder: processLeaderboard(coderQuery, 'coderWins', 'coderMatches'),
                tester: processLeaderboard(testerQuery, 'testerWins', 'testerMatches')
            });

        } catch (err) {
            console.error("Error retrieving leaderboard with MMR:", err);
            return res.status(500).json({ error: "Error loading rankings." });
        }
    }
}