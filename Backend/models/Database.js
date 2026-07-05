import { Sequelize, DataTypes } from "sequelize";
import { createModel as createPlayerModel } from "./Player.js";
import { createModel as createMatchModel } from "./Match.js";
import { createModel as createChallengeModel } from "./Challenge.js"
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Specifica il percorso esatto risalendo di una cartella
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

export const database = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: false,
    define: {
      timestamps: true,
      underscored: false
    }
  }
);

createPlayerModel(database);
createMatchModel(database);
createChallengeModel(database);

export const { Player, Match, Challenge } = database.models;

// Relazioni dai Match verso i Player

// I ruoli tecnici
Match.belongsTo(Player, { foreignKey: 'coderId', as: 'Coder', targetKey: 'playerId' });
Match.belongsTo(Player, { foreignKey: 'testerId', as: 'Tester', targetKey: 'playerId' });


// Il vincitore finale
Match.belongsTo(Player, { foreignKey: 'winnerId', as: 'Winner', targetKey: 'playerId' });


// Relazioni dai Player verso i Match (per le statistiche e lo storico)

// Tutti i match giocati come Coder e come Tester
Player.hasMany(Match, { foreignKey: 'coderId', as: 'Coder' });
Player.hasMany(Match, { foreignKey: 'testerId', as: 'Tester' });


// Relazioni tra Match e Challenge

// Un Match appartiene a una singola Challenge
Match.belongsTo(Challenge, { foreignKey: 'challengeId', as: 'Challenge' });

// Ogni Challenge può essere giocata in molti Match
Challenge.hasMany(Match, { foreignKey: 'challengeId', as: 'Matches' });


// Popoliamo il db con le Challenge (Eseguito SOLO all'avvio del server)
const seedChallengesDatabase = async (Challenge) => {
  try {
    // Rileviamo quante sfide ci sono nel DB in questo preciso momento
    let totalDbCount = await Challenge.count();

    // Se il database è vuoto, carica le prime 10 challenge core
    if (totalDbCount === 0) {
      const corePath = path.resolve('./data/challenges.json');
      if (fs.existsSync(corePath)) {
        const coreChallenges = JSON.parse(fs.readFileSync(corePath, 'utf8'));
        await Challenge.bulkCreate(coreChallenges);
        console.log("Success! Core Challenges correctely uploaded to the Database!");
        
        // Ricalcoliamo subito il totale per far funzionare il blocco successivo se new-challenges è già popolato
        totalDbCount = await Challenge.count();
      }
    }

    // Controllo e aggiunta Challenge da file new-challenges.json
    const newChallengesPath = path.resolve('./data/new-challenges.json');
    
    if (!fs.existsSync(newChallengesPath)) {
      console.log("There's no 'new-challenges.json' file into the '/data' folder.");
      return;
    }

    const newChallenges = JSON.parse(fs.readFileSync(newChallengesPath, 'utf8'));
    const expectedNewCount = newChallenges.length;

    // Calcoliamo quante sfide aggiuntive ha attualmente il DB (escluse le prime 10 base)
    const currentAdditionalInDb = totalDbCount - 10;

    // Se nel JSON ci sono più sfide aggiuntive di quelle registrate nel DB, le inseriamo
    if (expectedNewCount > currentAdditionalInDb) {
      console.log(`New Challenges detected! Synchronizing the database...`);

      // Prendiamo solo la fetta di array che manca all'appello
      const sliceToInsert = newChallenges.slice(currentAdditionalInDb);

      for (const nextCh of sliceToInsert) {
        try {
          await Challenge.create(nextCh);
          console.log(`New Challenge uploaded: "${nextCh.title}"`);
        } catch (insertErr) {
          if (insertErr.name === 'SequelizeUniqueConstraintError') {
            console.warn(`Uniqueness constraint for the Challenge title violated: "${nextCh.title}" already exists.`);
          } else {
            console.error(`Error while uploading the Challenge "${nextCh.title}":`, insertErr.message);
          }
        }
      }
      console.log("Synchronization for the new Challenges complete.");
    } else {
      console.log("No additional Challenges to add.");
    }

  } catch (err) {
    console.error("Critical error during Challenge seeding:", err);
  }
};

// Sincronizzazione Database
database.sync().then(() => {
  // Esegue i seed all'avvio
  seedChallengesDatabase(database.models.Challenge);
  console.log("Database successfully synchronized!");
}).catch(err => {
  console.error("Error with database synchronization: " + err.message);
});