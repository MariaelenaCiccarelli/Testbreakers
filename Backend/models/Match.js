import { DataTypes } from "sequelize";

export function createModel(database) {
  return database.define('Match', {
    matchId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    status: {
      type: DataTypes.ENUM('running', 'finished', 'abandoned'),
      defaultValue: 'running'
    },
    challengeId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    coderId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    testerId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    coderTimeLeft: {
      type: DataTypes.INTEGER,
      defaultValue: 180
    },
    testerTimeLeft: {
      type: DataTypes.INTEGER,
      defaultValue: 180
    },
    turn: {
      type: DataTypes.ENUM('coder', 'tester'),
      defaultValue: 'tester' 
    },
    // Questo è il DOM attuale modificato dal Coder
    lastCoderCode: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    // Questo è il set di Test attuale modificato dal Tester
    lastTesterCode: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    winnerId: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    timestamps: true
  });
}