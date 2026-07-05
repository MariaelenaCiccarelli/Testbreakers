import { Player, Match, Challenge } from "../models/Database.js";
import { AuthController } from "./AuthController.js";
import { Op } from "sequelize";

export class PlayerController {

    static async getPlayerInfo(req, res, next) {
        try {
            const authenticatedPlayerId = req.player.playerId;

            // Recuperiamo tutti i giocatori dal database per calcolare le posizioni reali globali
            // Se il database dovesse scalare a migliaia di utenti, questo approccio si DEVE ottimizzare
            const allPlayers = await Player.findAll({
                attributes: [
                    'playerId', 'handle', 'totalWins', 'matchesDone',
                    'coderWins', 'coderMatches', 'testerWins', 'testerMatches'
                ]
            });

            // Troviamo l'utente corrente nell'elenco
            const currentPlayerObj = allPlayers.find(p => p.playerId === authenticatedPlayerId);
            if (!currentPlayerObj) {
                return res.status(404).json({ error: "Player not found" });
            }

            // Funzione di supporto interna per calcolare l'MMR logaritmico identico alla Leaderboard
            const calculateMmr = (wins, matches) => {
                const winRate = matches > 0 ? (wins / matches) * 100 : 0;
                const baseWinsScore = wins * 5;
                const logFactor = Math.log10(matches + 1);
                const winRateBonus = winRate * logFactor * 50;
                return Math.round(baseWinsScore + winRateBonus);
            };

            // Mappiamo tutti i player calcolando i rispettivi MMR per i 3 ranking
            const rankedPlayers = allPlayers.map(p => ({
                playerId: p.playerId,
                globalMmr: calculateMmr(p.totalWins, p.matchesDone),
                coderMmr: calculateMmr(p.coderWins, p.coderMatches),
                testerMmr: calculateMmr(p.testerWins, p.testerMatches)
            }));

            // Ordiniamo le classifiche virtuali per calcolare la posizione esatta (Rank)
            const globalRank = rankedPlayers.sort((a, b) => b.globalMmr - a.globalMmr).findIndex(p => p.playerId === authenticatedPlayerId) + 1;
            const coderRank = rankedPlayers.sort((a, b) => b.coderMmr - a.coderMmr).findIndex(p => p.playerId === authenticatedPlayerId) + 1;
            const testerRank = rankedPlayers.sort((a, b) => b.testerMmr - a.testerMmr).findIndex(p => p.playerId === authenticatedPlayerId) + 1;

            // Recuperiamo l'anagrafica completa del giocatore con i dati reali
            const player = await Player.findByPk(authenticatedPlayerId);

            // Calcolo dei singoli Win Rate protetti
            const globalWinRate = player.matchesDone > 0 ? parseFloat(((player.totalWins / player.matchesDone) * 100).toFixed(1)) : 0;
            const coderWinRate = player.coderMatches > 0 ? parseFloat(((player.coderWins / player.coderMatches) * 100).toFixed(1)) : 0;
            const testerWinRate = player.testerMatches > 0 ? parseFloat(((player.testerWins / player.testerMatches) * 100).toFixed(1)) : 0;

            // Query per la cronologia dei match (Inalterata e performante)
            const matchHistory = await Match.findAll({
                where: {
                    [Op.or]: [
                        { coderId: authenticatedPlayerId }, 
                        { testerId: authenticatedPlayerId }
                    ],
                    status: {
                        [Op.in]: ['finished', 'abandoned']
                    }
                },
                include: [
                    { model: Challenge, as: 'Challenge', attributes: ['title'] },
                    { model: Player, as: 'Coder', attributes: ['handle', 'avatar'] },
                    { model: Player, as: 'Tester', attributes: ['handle', 'avatar'] },
                    { model: Player, as: 'Winner', attributes: ['handle'] }
                ],
                order: [['updatedAt', 'DESC']]
            });

            const formattedHistory = matchHistory.map(match => {
                const myRole = match.coderId === authenticatedPlayerId ? 'coder' : 'tester';
                let outcome = 'LOSS';
                if (match.status === 'abandoned') {
                    outcome = 'ABANDONED';
                } else if (match.winnerId === authenticatedPlayerId) {
                    outcome = 'WIN';
                }
                return {
                    matchId: match.matchId,
                    challengeTitle: match.Challenge ? match.Challenge.title : 'Challenge',
                    date: match.updatedAt,
                    roleInMatch: myRole,
                    result: outcome,
                    opponent: myRole === 'coder' ? match.Tester?.handle : match.Coder?.handle,
                    opponentAvatar: myRole === 'coder' ? match.Tester?.avatar : match.Coder?.avatar,
                    score: match.score || 'N/D',
                    lastCoderCode: match.lastCoderCode,
                    lastTesterCode: match.lastTesterCode,
                    finalWinnerHandle: match.Winner ? match.Winner.handle : 'Nessuno'
                };
            });

            // Output JSON arricchito con Rank e Win Rate per ogni sezione!
            return res.status(200).json({
                profile: {
                    handle: player.handle,
                    avatar: player.avatar,
                    totalWins: player.totalWins,
                    matchesDone: player.matchesDone,
                    globalWinRate: globalWinRate,
                    globalRank: globalRank, // Posizione globale reale!
                    
                    coderWins: player.coderWins,
                    coderMatches: player.coderMatches,
                    coderWinRate: coderWinRate,
                    coderRank: coderRank,
                    
                    testerWins: player.testerWins,
                    testerMatches: player.testerMatches,
                    testerWinRate: testerWinRate,
                    testerRank: testerRank,
                    
                    bestStreak: player.bestStreak,
                    actualStreak: player.actualStreak
                },
                history: formattedHistory
            });

        } catch (err) {
            console.error("Error retrieving advanced profile info:", err);
            return res.status(500).json({ error: "Unable to retrieve Personal Area data." });
        }
    }

    static async updateAvatar(req, res, next) {
        try {
            const authenticatedPlayerId = req.player.playerId;
            const { avatar } = req.body;

            if (!avatar) {
                return res.status(400).json({ error: "No Avatar specified for update." });
            }

            // Trova il giocatore nel DB
            const player = await Player.findByPk(authenticatedPlayerId);
            if (!player) {
                return res.status(404).json({ error: "Player not found." });
            }

            // Aggiorna l'avatar
            player.avatar = avatar;
            await player.save();

            // GENERIAMO UN NUOVO JWT FRESH:
            // Visto che l'avatar viene stampato nella navbar e nell'area personale,
            // rimandiamo un token aggiornato così il frontend si allinea all'istante ovunque
            const updatedToken = AuthController.issueToken(player);

            return res.status(200).json({
                message: "Avatar updated successfully.",
                avatar: player.avatar,
                token: updatedToken
            });

        } catch (err) {
            console.error("Avatar update error:", err);
            return res.status(500).json({ error: "Unable to update Avatar." });
        }
    }

    static async getCurrentStreak(req, res, next) {
        try {
            // L'ID viene estratto in modo sicuro dal middleware enforceAuthentication
            const authenticatedPlayerId = req.player.playerId;

            // Estraiamo solo ed esclusivamente il campo actualStreak, query ultra-leggera
            const player = await Player.findByPk(authenticatedPlayerId, {
                attributes: ['actualStreak']
            });

            if (!player) {
                return res.status(404).json({ error: "Player not found." });
            }

            return res.status(200).json({
                actualStreak: player.actualStreak || 0
            });

        } catch (err) {
            console.error("Error retrieving real-time winning streak:", err);
            return res.status(500).json({ error: "Error winning streak subsystem." });
        }
    }
}