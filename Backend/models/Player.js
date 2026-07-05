import { DataTypes } from "sequelize";
import bcrypt from "bcrypt";

export function createModel(database) {
  database.define('Player', {
    playerId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    handle: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      set(value) {
        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync(value, salt);
        this.setDataValue('password', hash);
      }
    },
    avatar: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'default-avatar.png'
    },
    coderWins: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    testerWins: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    coderMatches: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    testerMatches: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    totalWins: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    matchesDone: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    bestStreak: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    actualStreak: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    }
  });
}
