const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Wallet = sequelize.define(
  "Wallet",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    owner_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    crc_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    balance: {
      type: DataTypes.DECIMAL(18, 8),
      defaultValue: 0,
    },
    balance_lck: {
      type: DataTypes.DECIMAL(18, 8),
      defaultValue: 0,
    },
  },
  {
    tableName: "wallets",
    createdAt: "cdate",
    updatedAt: "udate",
    indexes: [
      {
        unique: true,
        fields: ["owner_id", "crc_id"],
      },
    ],
  }
);

module.exports = Wallet;
