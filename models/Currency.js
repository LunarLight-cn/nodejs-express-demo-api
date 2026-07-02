const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Currency = sequelize.define(
  "Currency",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    code: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    type: {
      type: DataTypes.ENUM("fiat", "crypto"),
      allowNull: false,
    },
    decimal: {
      type: DataTypes.INTEGER,
      defaultValue: 2,
    },
    min_withdraw: {
      type: DataTypes.DECIMAL(18, 8),
      defaultValue: 0,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: "currencies",
    timestamps: false,
  }
);

module.exports = Currency;
