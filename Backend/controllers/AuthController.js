import { Player } from "../models/Database.js";
import Jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import fs from 'fs';
import path from 'path';


export class AuthController {  
  
  static async login(req, res, next){
    try{
      const { handle, password } = req.body;
      const found = await Player.findOne({ where: { handle } });
      
      if(found && await bcrypt.compare(password, found.password)) {
        //Generiamo il token
        const token = AuthController.issueToken(found);
        return res.json({ token });
      }else{
        //Credenziali errate
        return res.status(401).json({ error: "Invalid credentials. Please try again." });
      }     
    }catch(err){
      next(err);
    }
  }

  static async signup(req, res, next) {
    try {
      const { handle, password, avatar } = req.body;

      if (!handle || !password) {
        return res.status(400).json({ error: "Handle and Security Key are mandatory requirements for access." });
      }

      //Creazione nuovo Player
      const player = await Player.create({
        handle: handle.trim(), // .trim() elimina spazi vuoti accidentali prima/dopo
        password,
        avatar
      });

      //Prepariamo la risposta rimuovendo la password
      const playerResponse = player.toJSON();
      delete playerResponse.password;

      return res.status(201).json(playerResponse);

    } catch(err) {
      // Gestione errori specifica per la registrazione
      if(err.name === 'SequelizeValidationError'){
        return res.status(400).json({
          error: "Validation failed.",
          details: err.errors.map(e => e.message)
        });
      }else if(err.name === 'SequelizeUniqueConstraintError'){
        const fields = err.errors.map(e => e.path);
        if(fields.includes('handle')){
          return res.status(409).json({ error: "Handle already in use." });
        }else{
          return res.status(409).json({ error: "Duplicate entry." });
        }
      }else{
        next(err);
      }
    }
  }

  static issueMatchToken(player, matchId, role) {
    return Jwt.sign(
        { 
            playerId: player.playerId, 
            handle: player.handle,
            avatar: player.avatar,
            matchId: matchId, // Vincola il token a QUESTO match
            role: role        // 'coder' o 'tester'
        },
        process.env.TOKEN_SECRET,
        { expiresIn: '1h' }   // Breve durata per la sessione di gioco
    );
  }

  static issueToken(player) {
    return Jwt.sign({
        playerId: player.playerId,
        handle: player.handle,
        avatar: player.avatar
      },
      process.env.TOKEN_SECRET,
      { expiresIn: '24h' });
  }

  static verifyToken(token) {
    // Se il token è invalido, lancia un'eccezione che viene catturata nella funzione chiamante
    return Jwt.verify(token, process.env.TOKEN_SECRET);
  }

  static async getAvailableAvatars(req, res, next) {
    try {
      // Impostiamo il percorso della cartella degli avatar
      const avatarsDir = path.join(process.cwd(), 'public', 'avatars');

      // Leggiamo tutti i file all'interno della cartella
      fs.readdir(avatarsDir, (err, files) => {
        if (err) {
          console.error("Error reading Avatar folder:", err);
          return res.status(500).json({ error: "Unable to retrieve Avatars from server." });
        }

        // Filtriamo solo i file con estensione immagine (es. png, jpg) ed escludiamo l'avatar di default
        const imageFiles = files.filter(file => 
          (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg')) && 
          file !== 'default-avatar.png'
        );

        // Mappiamo i file estraendo il colore in modo dinamico dal nome "avatar-01-blue.png"
        const avatars = imageFiles.map(file => {
          // Rimuoviamo l'estensione e dividiamo la stringa tramite il carattere "-"
          const nameParts = file.replace(/\.[^/.]+$/, "").split("-");
          
          // Il formato è avatar-[numero]-[colore], il colore si troverà nell'ultima posizione
          const color = nameParts.length >= 3 ? nameParts[2].toLowerCase() : 'unknown';

          return {
            file: file,
            color: color
          };
        });

        return res.status(200).json({ avatars });
      });

    } catch (err) {
      next(err);
    }
  }

}