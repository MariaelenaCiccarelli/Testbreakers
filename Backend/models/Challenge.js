import { DataTypes } from "sequelize";

export function createModel(database) {
  return database.define('Challenge', {
    challengeId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    particularities: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    templateHTML: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    templateTest: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    time: {
      type: DataTypes.INTEGER,
      defaultValue: 180
    }
  });
}