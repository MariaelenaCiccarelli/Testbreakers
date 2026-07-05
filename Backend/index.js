import express from "express";
import morgan from "morgan";

import { authenticationRouter } from "./routes/authenticationRouter.js"
import { matchRouter } from "./routes/matchRouter.js"
import { playerRouter } from "./routes/playerRouter.js"
import { leaderboardRouter } from "./routes/leaderboardsRouter.js";
import { enforceAuthentication } from "./middleware/authorization.js";
import { challengeRouter } from "./routes/challengeRouter.js";

const app = express();
const PORT = 3000;

app.use('/uploads', express.static('public/avatars'));
app.use(morgan('dev'));
app.use(express.json());

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        code: err.status || 500,
        description: err.message || "An error occurred."
    });
});

app.use(challengeRouter);
app.use(leaderboardRouter);
app.use(authenticationRouter);
app.use(matchRouter);
app.use(enforceAuthentication);
app.use(playerRouter);

app.listen(PORT, () => {
    console.log(`Server listening.`);
});