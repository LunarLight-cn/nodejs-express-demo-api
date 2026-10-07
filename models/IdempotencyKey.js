const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const IdempotencyKey = sequelize.define(
  "IdempotencyKey",
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
    key: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    endpoint: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    request_hash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("processing", "completed", "failed"),
      defaultValue: "processing",
    },
    response_code: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    response_body: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "idempotency_keys",
    indexes: [
      {
        unique: true,
        fields: ["user_id", "key"],
      },
      {
        fields: ["expires_at"],
      },
    ],
    createdAt: "cdate",
    updatedAt: "udate",
  }
);

module.exports = IdempotencyKey;
