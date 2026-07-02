const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Order = sequelize.define(
  "Order",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM("buy", "sell"),
      allowNull: false,
    },
    base_crc_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    quote_crc_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    price: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: false,
    },
    remain_amount: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("open", "partial", "completed", "cancelled"),
      defaultValue: "open",
    },
  },
  {
    tableName: "orders",
    createdAt: "cdate",
    updatedAt: "udate",
  }
);

module.exports = Order;
