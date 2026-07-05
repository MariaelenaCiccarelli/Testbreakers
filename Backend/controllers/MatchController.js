import { Player, Match, Challenge } from "../models/Database.js";
import { AuthController } from "./AuthController.js";
import { Sequelize } from "sequelize";
import { JSDOM } from "jsdom";
import bcrypt from "bcrypt";
import { promises as fs } from 'fs';
import path from "path";

// Helper centrale per ricavare il path assoluto della cartella dataset
const getExternalDatasetPath = (matchId = null) => {
    // Risale di un livello rispetto alla root del backend (process.cwd()) ed entra in dataset
    const baseDir = path.resolve(process.cwd(), '..', 'Dataset');
    return matchId ? path.join(baseDir, `match_${matchId}.json`) : baseDir;
};

// Helper per creare il file alla creazione del match nel dataset
async function initializeMatchDataset(matchId, challengeId, challengeTitle, challengeDescription, coderId, coderHandle, testerId, testerHandle) {
    try {
        const dirPath = getExternalDatasetPath();
        // Crea la cartella dataset esterna se non esiste
        await fs.mkdir(dirPath, { recursive: true });

        const filePath = getExternalDatasetPath(matchId);

        const datasetTemplate = {
            matchId: Number(matchId),
            challengeId: Number(challengeId),
            challengeTitle: challengeTitle || "Sfida",
            challengeDescription: challengeDescription || "",
            players: {
                coder: { playerId: Number(coderId), handle: coderHandle },
                tester: { playerId: Number(testerId), handle: testerHandle }
            },
            status: "running",
            winner: null,
            endReason: null,
            createdAt: new Date().toISOString(),
            endedAt: null,
            turnsHistory: []
        };

        await fs.writeFile(filePath, JSON.stringify(datasetTemplate, null, 2), "utf-8");
        console.log(`Match #${matchId} file created in the Dataset`);
    } catch (err) {
        console.error("Error initializing file in Dataset:", err);
    }
}

// Helper per aggiornare i turni nel dataset
async function appendTurnToDataset(matchId, playerRole, code, currentHtml) {
    try {
        const filePath = getExternalDatasetPath(matchId);
        
        // Verifichiamo se il file esiste
        try {
            await fs.stat(filePath);
        } catch {
            return;
        }

        const fileData = await fs.readFile(filePath, "utf-8");
        const dataset = JSON.parse(fileData);

        const newTurn = {
            turnNumber: dataset.turnsHistory.length + 1,
            submittedBy: playerRole,
            timestamp: new Date().toISOString(),
            playwrightTests: playerRole === 'tester' ? code : (dataset.turnsHistory[dataset.turnsHistory.length - 1]?.playwrightTests || ""),
            htmlCode: playerRole === 'coder' ? code : currentHtml
        };

        dataset.turnsHistory.push(newTurn);
        await fs.writeFile(filePath, JSON.stringify(dataset, null, 2), "utf-8");
    } catch (err) {
        console.error("Error updating file in Dataset:", err);
    }
}

// Helper per salvare il vincitore nel dataset
async function finalizeDatasetWinner(matchId, winningRole, reason) {
    try {
        const filePath = getExternalDatasetPath(matchId);
        
        try {
            await fs.stat(filePath);
        } catch {
            return;
        }

        const fileData = await fs.readFile(filePath, "utf-8");
        const dataset = JSON.parse(fileData);

        dataset.status = "finished";
        dataset.winner = winningRole;
        dataset.endReason = reason;
        dataset.endedAt = new Date().toISOString();

        await fs.writeFile(filePath, JSON.stringify(dataset, null, 2), "utf-8");
        console.log(`Match #${matchId} successfully finalized in Dataset.`);
    } catch (err) {
        console.error("Error saving winner to Dataset:", err);
    }
}

// Helper per gestire l'abbandono del match nel dataset
async function abandonMatchDataset(matchId) {
    try {
        const filePath = getExternalDatasetPath(matchId);
        
        try {
            await fs.stat(filePath);
        } catch {
            return;
        }

        const fileData = await fs.readFile(filePath, "utf-8");
        const dataset = JSON.parse(fileData);

        dataset.status = "abandoned";
        dataset.winner = null;
        dataset.endReason = "abandoned";
        dataset.endedAt = new Date().toISOString();

        await fs.writeFile(filePath, JSON.stringify(dataset, null, 2), "utf-8");
        console.log(`Match #${matchId} marked as abandoned in the Dataset.`);
    } catch (err) {
        console.error("Error updating Dataset while abandoning:", err);
    }
}

// Helper per aggiornare le statistiche a fine match
async function updatePlayerStats(winnerId, loserId, winningRole) {
    const winner = await Player.findByPk(winnerId);
    const loser = await Player.findByPk(loserId);

    if (winner && loser) {
        winner.matchesDone += 1;
        loser.matchesDone += 1;
        winner.totalWins += 1;
        if (winningRole === 'coder') {
            winner.coderWins += 1;
            winner.coderMatches += 1;
            loser.testerMatches += 1;
        } else {
            winner.testerWins += 1;
            winner.testerMatches += 1;
            loser.coderMatches += 1;
        }

        winner.actualStreak += 1;
        if (winner.actualStreak > winner.bestStreak) {
            winner.bestStreak = winner.actualStreak;
        }
        loser.actualStreak = 0; 

        await winner.save();
        await loser.save();
    }
}

// Estrae tutti i selettori CSS racchiusi dentro page.locator('...') o page.locator("...")
function extractCssSelectors(testerCode) {
    if (!testerCode) return [];
    const selectors = [];
    
    // Questa regex cattura l'apice di apertura (' o ") e si ferma SOLO al corrispettivo apice di chiusura \
    const regex = /page\.locator\(\s*['"`](?:css=)?(.*?)(['"`])\s*\)/g;
    
    let match;
    while ((match = regex.exec(testerCode)) !== null) {
        let selector = match[1].trim();
        
        // Pulizia di sicurezza nel caso in cui l'apice di chiusura sia rimasto agganciato per via di spazi insoliti
        selector = selector.replace(/['"`]$/, '').trim();
        
        // Se il selettore è vuoto, o contiene solo "css=", lo ignoriamo e non lo inseriamo
        if (selector && selector !== 'css=') {
            selectors.push(selector);
        }
    }

    return selectors;
}

// Controllo globale mustNotContain: nessun selettore del Tester può contenere scorciatoie vietate (# o id=)
function validateTesterAntiCheat(selectors) {
    for (const selector of selectors) {
        if (selector.includes('#') || selector.toLowerCase().includes('id=')) {
            return false;
        }
    }
    return true;
}

// Mappa l'albero DOM per il Tester
// Restituisce sia l'ID (per l'ordine del template HTML) sia il riferimento al nodo DOM reale trovato da JSDOM
// Verifica "Strict Mode" (Unicità del selettore)
function mapSelectorsToElements(htmlCode, selectors) {
    const dom = new JSDOM(htmlCode);
    const doc = dom.window.document;
    const results = [];

    for (const selector of selectors) {
        try {
            // Usiamo querySelectorAll per intercettare tutti i nodi che combaciano
            const allMatchingElements = doc.querySelectorAll(selector);
            if (allMatchingElements.length === 1) {
                // Caso ideale: il selettore è unico (Strict Mode superato)
                const element = allMatchingElements[0];
                // Troviamo l'ID logico risalendo se necessario (per il controllo dell'expectedOrder)
                let resolvedId = element.id;
                if (!resolvedId) {
                    const closestWithId = element.closest('[id]');
                    resolvedId = closestWithId ? closestWithId.id : 'no-id-detected';
                }
                
                results.push({
                    selector: selector,
                    id: resolvedId,
                    node: element, // Manteniamo il riferimento all'oggetto nodo fisico in memoria
                    isAmbiguous: false // Segnale verde: selettore ok
                });
            } else if (allMatchingElements.length > 1) {
                // Il selettore è ambiguo, colpisce troppi elementi!
                results.push({ 
                    selector: selector, 
                    id: null, 
                    node: null, 
                    isAmbiguous: true // Segnale rosso: selettore ambiguo
                });
            } else {
                results.push({ selector: selector, id: null, node: null });
            }
        } catch (e) {
            results.push({ selector: selector, id: null, node: null });
        }
    }
    return results;
}


// Controlla l'integrità del Coder (Nessun ID cancellato, spostato o TAG mutato)
function checkCoderStructuralIntegrity(originalHtml, coderHtml) {
    const domOriginal = new JSDOM(originalHtml);
    const domCoder = new JSDOM(coderHtml);
    
    const docOriginal = domOriginal.window.document;
    const docCoder = domCoder.window.document;

    // Estrazione della lista degli elementi con ID nell'esatto ordine posizionale
    const originalElements = Array.from(docOriginal.querySelectorAll('[id]'));
    const coderElements = Array.from(docCoder.querySelectorAll('[id]'));

    const originalIds = originalElements.map(el => el.id);
    const coderIds = coderElements.map(el => el.id);

    // Filtraggio degli ID del Coder mantenendo solo quelli nativi del template
    const filteredCoderIds = coderIds.filter(id => originalIds.includes(id));

    // Nessun ID originale deve essere stato rimosso
    if (originalIds.length !== filteredCoderIds.length) {
        return false;
    }

    // La sequenza posizionale degli ID deve essere preservata
    const isSequencePreserved = originalIds.every((id, index) => id === filteredCoderIds[index]);
    if (!isSequencePreserved) {
        return false;
    }

    // Impedisce il cambio del tipo di Tag (es: da <img> a <svg>)
    // Cicliamo su tutti gli elementi originali per verificare che il Coder non abbia mutato il tag nativo
    for (const origEl of originalElements) {
        const correspondingCoderEl = docCoder.getElementById(origEl.id);
        
        if (correspondingCoderEl) {
            if (origEl.tagName !== correspondingCoderEl.tagName) {
                // Il Coder ha cercato di barare mutando la natura del tag strutturale!
                return false;
            }
        }
    }

    return true;
}

// Controlla che il Coder non abbia introdotto duplicati vietati (cannotDouble)
function checkCoderDoubles(coderHtml, cannotDoubleList) {
    if (!cannotDoubleList || cannotDoubleList.length === 0) return true;
    
    const domCoder = new JSDOM(coderHtml);
    const doc = domCoder.window.document;

    for (const constraint of cannotDoubleList) {
        const idValueMatch = constraint.match(/id=["']?([^"']+)["']?/);
        if (idValueMatch) {
            const idValue = idValueMatch[1];
            const elements = doc.querySelectorAll(`[id="${idValue}"]`);
            // Se elements.length > 1 significa che il coder ha duplicato un ID
            if (elements.length > 1) {
                return false; 
            }
        }
    }
    return true;
}

export class MatchController {

    static async createMatch(req, res, next) {
        try {

            const { p2Handle, p2Password, p2Role, challengeId } = req.body;
            let player1, player2, p1Handle, p1Password;

            // Gestione Player 1 (Loggato o da Autenticare)
            if (req.player) {
                // Se optionalAuth ha trovato un token valido per P1, usiamo quello
                player1 = await Player.findByPk(req.player.playerId);
                if (!player1) return res.status(401).json({ error: "Invalid Session, Player 1 not found." });

            } else {

                // Altrimenti verifichiamo le credenziali fornite nel body
                p1Handle = req.body.p1Handle;
                p1Password = req.body.p1Password;
                if (!p1Handle || !p1Password) {
                    return res.status(400).json({ error: "Enter Player 1 credentials or log in." });
                }
                player1 = await Player.findOne({ where: { handle: p1Handle } });
                if (!player1) {
                    return res.status(404).json({ error: "Player 1 not found." });
                }
                if (!(await bcrypt.compare(p1Password, player1.password))) {
                    return res.status(401).json({ error: "Player 1 credentials are incorrect." });
                }

            }

            // Gestione Player 2 (Sempre da Autenticare)
            player2 = await Player.findOne({ where: { handle: p2Handle } });
            if (!player2) return res.status(404).json({ error: "Player 2 not found." });
            if (!(await bcrypt.compare(p2Password, player2.password))) {
                return res.status(401).json({ error: "Player 2 credentials are incorrect." });
            }

            // Validazione
            if (player1.playerId === player2.playerId) {
                return res.status(400).json({ error: "You can't challenge yourself!" });
            }

            // Scelta della sfida
            let challenge;
            
            if (!challengeId || challengeId === 'random') {
                // Se l'utente ha scelto "Random Challenge" o il campo è vuoto, la estraiamo casualmente
                challenge = await Challenge.findOne({
                    order: [Sequelize.fn('RANDOM')],
                });
            } else {
                // Altrimenti carichiamo esattamente la sfida selezionata dall'utente
                challenge = await Challenge.findByPk(challengeId);
            }

            if (!challenge) {
                throw { name: "NoChallengesAvailable" };
            }

            // Recuperiamo dinamicamente il tempo configurato per questa specifica sfida
            const challengeTime = challenge.time;

            // Assegnazione ruoli
            let coderId, testerId, coderAvatar, testerAvatar, coderHandle, testerHandle;
            if (p2Role === 'coder') {
                coderId = player2.playerId;
                testerId = player1.playerId;
                coderAvatar = player2.avatar;
                testerAvatar = player1.avatar;
                coderHandle = player2.handle;
                testerHandle = player1.handle;
            } else if (p2Role === 'tester') {
                coderId = player1.playerId;
                testerId = player2.playerId;
                coderAvatar = player1.avatar;
                testerAvatar = player2.avatar;
                coderHandle = player1.handle;
                testerHandle = player2.handle;
            } else {
                return res.status(400).json({ error: "Invalid role. Please choose 'coder' or 'tester'." });
            }

            // Creazione Match con legame diretto alla Challenge
            const match = await Match.create({
                coderId,
                testerId,
                challengeId: challenge.challengeId,
                status: 'running',
                coderTimeLeft: challengeTime,
                testerTimeLeft: challengeTime,
                turn: 'tester' // Inizia sempre il tester
            });

            // Generazione Match Tokens
            // Passiamo sia matchId che il ruolo specifico per blindare il token
            const tokenP1 = AuthController.issueMatchToken(
                player1,
                match.matchId,
                (coderId === player1.playerId ? 'coder' : 'tester')
            );

            const tokenP2 = AuthController.issueMatchToken(
                player2,
                match.matchId,
                (coderId === player2.playerId ? 'coder' : 'tester')
            );

            initializeMatchDataset(match.matchId, match.challengeId, challenge.title, challenge.description, coderId, coderHandle, testerId, testerHandle);
            // Risposta
            return res.status(201).json({
                match,
                coderAvatar: coderAvatar,
                testerAvatar: testerAvatar,
                coderHandle: coderHandle,
                testerHandle: testerHandle,
                matchTokens: {
                    player1: tokenP1,
                    player2: tokenP2
                }
            });

        } catch (err) {
            if (err.name === "NoChallengesAvailable") {
                return res.status(404).json({ error: "No Challenges available in the Database." });
            }
            next(err);
        }
    }

    static async getMatchChallenge(req, res) {
        try {
            const { matchId } = req.params;

            // Recuperiamo il match includendo la singola sfida associata tramite l'alias 'Challenge'
            const match = await Match.findByPk(matchId, {
                include: [{
                    model: Challenge,
                    as: 'Challenge'
                }]
            });

            // Validazione
            if (!match) {
                return res.status(404).json({ error: "Match not found." });
            }
            if (!match.Challenge) {
                return res.status(404).json({ error: "There are no Challenges associated with this Match." });
            }

            // Risposta al frontend con tutti i dati necessari per l'arena
            res.json({
                challenge: match.Challenge,
                matchStatus: match.status,
                coderTimeLeft: match.coderTimeLeft,
                testerTimeLeft: match.testerTimeLeft,
                turn: match.turn
            });
        } catch (err) {
            res.status(500).json({ error: "Error retrieving Challenge." });
        }
    }

    static async abandonMatch(req, res) {
    try {
        // Convertiamo esplicitamente il parametro in un numero puro
        const matchId = Number(req.params.matchId);

        // Eseguiamo la ricerca del match nel database
        const match = await Match.findByPk(matchId);

        if (!match) {
            return res.status(404).json({ error: "Match not found." });
        }

        if (match.status !== 'running') {
            return res.status(400).json({ error: "This Match has already finished." });
        }

        // Modifichiamo lo stato del match nel database
        match.status = 'abandoned';
        await match.save();

        // Aggiorniamo e sigilliamo il file nel dataset
        abandonMatchDataset(matchId);

        return res.json({ 
            status: 'success', 
            message: "Match successfully marked as abandoned." 
        });

    } catch (err) {
        console.error("Error in abandonMatch:", err);
        res.status(500).json({ error: "Internal error while handling abandonment." });
    }
}
    
    static async submitTurn(req, res) {
        try {
            const { matchId } = req.params;
            const { code, timeSpent } = req.body;
            const playerRole = req.player.role; // 'tester' oppure 'coder'

            const match = await Match.findByPk(matchId, {
                include: [{
                    model: Challenge,
                    as: 'Challenge'
                }]
            });

            if (!match) {
                return res.status(404).json({ error: "Match not found." });
            }

            if (match.status === 'finished' || match.status === 'abandoned') {
                return res.status(400).json({ error: "This match has already finished or has been abandoned." });
            }

            // Verifica che sia effettivamente il turno del ruolo richiedente
            if (match.turn !== playerRole) {
                return res.status(403).json({ error: `It's not your turn. It's the ${match.turn.toUpperCase()}'s turn.` });
            }

            let isCorrect = false;
            let errorMessage = "";
            // Variabile per il tester per l'esecuzione dei selettori sull'HTML Corrente del match (iniziale o modificato dall'ultimo turno del coder)
            const currentHtml = match.lastCoderCode || match.Challenge.templateHTML;
            
            if (!code || code.trim() === "") {
                return res.status(400).json({ error: "You cannot submit an empty code!" });
            } else {
                // Submit Tester
                if (playerRole === 'tester') {
                    match.testerTimeLeft -= timeSpent;
                
                    // Estrazione dei selettori dal codice Playwright sottomesso
                    const selectors = extractCssSelectors(code);
                    
                    if (selectors.length === 0) {
                        errorMessage = "Your test does not contain any valid selectors inside page.locator().";
                    } else if (!validateTesterAntiCheat(selectors)) {
                        errorMessage = "You cannot use IDs (# or id=) in your CSS locators.";
                    } else {
                        // Eseguiamo la risoluzione dei selettori sui nodi fisici del DOM di JSDOM
                        const resolvedSelections = mapSelectorsToElements(currentHtml, selectors);

                        // Verifica se c'è una violazione dello Strict Mode di Playwright
                        const hasAmbiguousSelector = resolvedSelections.some(sel => sel.isAmbiguous);

                        if (hasAmbiguousSelector) {
                            errorMessage = "Validation failed (Strict Mode)! One or more selectors are too general and affect multiple elements in the DOM, making the test ambiguous.";
                        } else {
                            // Controlliamo se tutti i selettori hanno trovato un elemento valido
                            const allSelectorsValid = resolvedSelections.every(sel => sel.node !== null);

                            if (allSelectorsValid) {
                                // Controllo di univocità fisica dei nodi (Anti-Cheat sui Duplicati)
                                // Inseriamo i nodi fisici restituiti da JSDOM dentro un Set per verificare le collisioni reali
                                const uniqueNodes = new Set(resolvedSelections.map(sel => sel.node));

                                if (uniqueNodes.size !== resolvedSelections.length) {
                                    errorMessage = "Validation failed! Two or more selectors are hitting the exact same element in the DOM. Each selector must test a unique node!";
                                } else {
                                    // Controllo dell'ordine di testing degli elementi core dati dal template HTML
                                    const expectedOrder = match.Challenge.particularities?.expectedOrder || [];
                                    // Estraiamo tutti gli ID colpiti dal Tester
                                    const targetedIds = resolvedSelections.map(sel => sel.id);
                                    // Filtriamo gli ID colpiti mantenendo solo quelli richiesti dalla sfida iniziale
                                    const filteredTargetedIds = targetedIds.filter(id => expectedOrder.includes(id));
                                    // Verifichiamo che l'ordine relativo dei campi nativi sia rispettato elemento per elemento
                                    const isOrderCorrect = expectedOrder.length === filteredTargetedIds.length && expectedOrder.every((val, index) => val === filteredTargetedIds[index]);

                                    if (!isOrderCorrect) {
                                        errorMessage = "Validation failed! You've either reversed the logical order of the core assertions or you're not testing the entire DOM tree.";
                                    } else {
                                        isCorrect = true;
                                        match.lastTesterCode = code; 
                                        match.turn = 'coder';
                                    }
                                }
                            } else {
                                errorMessage = "Your test fails! One or more selectors do not match any elements in the current HTML.";
                            }
                        }
                    }

                // Submit Coder
                } else if (playerRole === 'coder') {
                    match.coderTimeLeft -= timeSpent;

                    // Controllo di Integrità Strutturale (Non può rimuovere ID o nodi esistenti nel template originale della sfida)
                    const originalHtml = match.Challenge.templateHTML;
                    
                    // Controllo Anti-Clonazione ID (cannotDouble definito nella singola sfida)
                    const cannotDoubleList = match.Challenge.particularities?.cannotDouble || [];

                    if (!checkCoderDoubles(code, cannotDoubleList)) {
                        errorMessage = "Illegal move! You cannot duplicate sensitive IDs protected by this challenge in the DOM.";
                    } else if (!checkCoderStructuralIntegrity(originalHtml, code)) {
                        errorMessage = "Illegal move! You have removed, modified, or altered any structural nodes or native IDs in the Challenge.";
                    } else {
                        // Recuperiamo i selettori attivi del Tester dal turno precedente
                        const lastTesterCode = match.lastTesterCode;
                        const activeSelectors = extractCssSelectors(lastTesterCode);

                        // Mappiamo come risolvevano questi selettori sull'HTML vecchio per sapere quali ID core venivano intercettati con successo dal Tester
                        const previousHtml = match.lastCoderCode || match.Challenge.templateHTML;
                        const oldSelections = mapSelectorsToElements(previousHtml, activeSelectors);

                        // Istanziamo il DOM modificato dal Coder per verificare il sabotaggio reale
                        const domCoder = new JSDOM(code);
                        const docCoder = domCoder.window.document;

                        let sabotageSuccessful = false;

                        // Analizziamo selettore per selettore
                        for (let i = 0; i < activeSelectors.length; i++) {
                            const selector = activeSelectors[i];
                            const oldSelection = oldSelections[i];

                            // Se nel turno precedente questo selettore non aveva agganciato un elemento core valido, lo saltiamo
                            if (!oldSelection || !oldSelection.node) continue;

                            try {
                                const matchingElements = docCoder.querySelectorAll(selector);

                                // Il selettore si è rotto del tutto (0 elementi)
                                if (matchingElements.length === 0) {
                                    sabotageSuccessful = true;
                                    break;
                                }

                                // Il selettore è diventato ambiguo (> 1 elemento)
                                if (matchingElements.length > 1) {
                                    sabotageSuccessful = true;
                                    break;
                                }

                                // Il selettore trova 1 solo elemento, MA ha deviato su un bersaglio sbagliato!
                                if (matchingElements.length === 1) {
                                    const currentElement = matchingElements[0];
                                    
                                    // Ricaviamo l'ID reale (o del closest) del nuovo elemento colpito
                                    let currentResolvedId = currentElement.id;
                                    if (!currentResolvedId) {
                                        const closestWithId = currentElement.closest('[id]');
                                        currentResolvedId = closestWithId ? closestWithId.id : 'no-id-detected';
                                    }

                                    // Se l'ID colpito ora è diverso da quello che il Tester aveva correttamente isolato nel turno precedente, il Coder ha deviato il test su un fake!
                                    if (currentResolvedId !== oldSelection.id) {
                                        sabotageSuccessful = true;
                                        break;
                                    }
                                }

                            } catch (e) {
                                sabotageSuccessful = false;
                                break;
                            }
                        }

                        if (sabotageSuccessful) {
                            isCorrect = true;
                            match.lastCoderCode = code; 
                            match.turn = 'tester'; 
                        } else {
                            errorMessage = "Selector break attempt failed! All CSS selectors in Tester still hit valid DOM elements.";
                        }
                    }
                }
            }

            // Controllo tempo e salvataggio
            const currentPlayerTime = playerRole === 'tester' ? match.testerTimeLeft : match.coderTimeLeft;
            if (currentPlayerTime <= 0) {
                match.status = 'finished';
                match.winnerId = playerRole === 'tester' ? match.coderId : match.testerId;
                const loserId = playerRole === 'tester' ? match.testerId : match.coderId;
                const winningRole = playerRole === 'tester' ? 'coder' : 'tester';

                await updatePlayerStats(match.winnerId, loserId, winningRole);
                
                await match.save();
                
                finalizeDatasetWinner(match.matchId, winningRole, 'timeout');
                return res.json({ 
                    status: 'match_finished', 
                    winner: winningRole, 
                    message: "Time's up! The match is over.",
                    match 
                });
            }
                
            await match.save();
            
            if (isCorrect) {
                let whoSubmitted = match.turn === "tester" ? "coder" : "tester";
                // Passiamo l'HTML corrente memorizzato all'inizio della sottomissione
                appendTurnToDataset(match.matchId, whoSubmitted, code, currentHtml);
                return res.json({
                    status: 'success',
                    message: `Round successfully completed! It's the ${match.turn.toUpperCase()}'s turn.`,
                    turn: match.turn,
                    coderTimeLeft: match.coderTimeLeft,
                    testerTimeLeft: match.testerTimeLeft,
                    lastTesterCode: match.lastTesterCode,
                    lastCoderCode: match.lastCoderCode
                });
            } else {
                return res.json({
                    status: 'retry',
                    message: errorMessage || "Invalid move! The submitted code does not meet the structural and semantic constraints established for this turn.",
                    turn: match.turn,
                    coderTimeLeft: match.coderTimeLeft,
                    testerTimeLeft: match.testerTimeLeft,
                    lastTesterCode: match.lastTesterCode,
                    lastCoderCode: match.lastCoderCode
                });
            }

        } catch (err) {
            console.error("Error in submitTurn:", err);
            res.status(500).json({ error: "Internal error while processing turn shifting." });
        }
    }
}
