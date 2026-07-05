import { AuthController } from "../controllers/AuthController.js";


export function enforceAuthentication(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: "Access denied. Token missing." });
    }

    try {
        // Verifichiamo il token
        const decodedToken = AuthController.verifyToken(token);
        // Salviamo i dati del Player nella richiesta per i controller successivi
        req.player = decodedToken;
        next();
    } catch (err) {
        // Se il token è scaduto o manipolato, jwt.verify lancia un errore
        return res.status(401).json({ error: "Your session has expired or is invalid. Please log in again." });
    }
}

//Middleware "leggero"
//Prova a leggere il token 24h, ma se non c'è si limita a non popolare req.player
export function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return next(); // Nessun token, proseguiamo verso il login manuale
    const token = authHeader.split(' ')[1];
    try {
        const decoded = AuthController.verifyToken(token);
        req.player = decoded;
        next();
    } catch (err) {
        // Se il token c'è ma è marcio, meglio dirlo all'utente
        return res.status(401).json({ error: "Your session has expired or is invalid. Please log in again or play as a guest." });
    }
}


export function enforceMatchToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: "Missing Match Token." });
    }
    try {
        const decoded = AuthController.verifyToken(token);
        // Verifichiamo che il token sia effettivamente un Match Token
        if (!decoded.matchId) {
            return res.status(403).json({ error: "Access denied. A specific Match Token is required." });
        }
        //Se la rotta contiene un :matchId
        //Verifichiamo che l'utente stia agendo sulla partita corretta
        const requestId = req.params.matchId;
        if (requestId && decoded.matchId != requestId) {
            return res.status(403).json({ error: "You are not allowed to edit this match." });
        }
        //Salviamo tutto nella req per i controller successivi
        req.player = decoded;
        //Ora req.player avrà: playerId, handle, matchId, role
        next();
    } catch (err) {
        return res.status(401).json({ error: "Match Session expired or invalid." });
    }
}