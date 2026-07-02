const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Trade = sequelize.define(
  "Trade",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    order_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    buyer_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    seller_id: {
      type: DataTypes.INTEGER,
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
    base_amount: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: false,
      comment: "Amount of base currency (crypto) traded",
    },
    quote_amount: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: false,
      comment: "Total cost in quote currency (fiat)",
    },
    status: {
      type: DataTypes.ENUM("pending_payment", "paid", "completed", "cancelled"),
      defaultValue: "pending_payment",
    },
  },
  {
    tableName: "trades",
    createdAt: "cdate",
    updatedAt: "udate",
  }
);

module.exports = Trade;
