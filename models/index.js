const User = require("./User");
const Currency = require("./Currency");
const Wallet = require("./Wallet");
const Order = require("./Order");
const Trade = require("./Trade");
const Transfer = require("./Transfer");
const IdempotencyKey = require("./IdempotencyKey");

// User
User.hasMany(Wallet, { foreignKey: "owner_id", as: "wallets" });
User.hasMany(Order, { foreignKey: "user_id", as: "orders" });
User.hasMany(Trade, { foreignKey: "buyer_id", as: "buyTrades" });
User.hasMany(Trade, { foreignKey: "seller_id", as: "sellTrades" });
User.hasMany(Transfer, { foreignKey: "sender_id", as: "sentTransfers" });
User.hasMany(Transfer, { foreignKey: "receiver_id", as: "receivedTransfers" });
User.hasMany(IdempotencyKey, { foreignKey: "user_id", as: "idempotencyKeys" });

// Currency
Currency.hasMany(Wallet, { foreignKey: "crc_id", as: "wallets" });

// Wallet
Wallet.belongsTo(User, { foreignKey: "owner_id", as: "owner" });
Wallet.belongsTo(Currency, { foreignKey: "crc_id", as: "currency" });

// Order
Order.belongsTo(User, { foreignKey: "user_id", as: "user" });
Order.belongsTo(Currency, { foreignKey: "base_crc_id", as: "baseCurrency" });
Order.belongsTo(Currency, { foreignKey: "quote_crc_id", as: "quoteCurrency" });
Order.hasMany(Trade, { foreignKey: "order_id", as: "trades" });

// Trade
Trade.belongsTo(Order, { foreignKey: "order_id", as: "order" });
Trade.belongsTo(User, { foreignKey: "buyer_id", as: "buyer" });
Trade.belongsTo(User, { foreignKey: "seller_id", as: "seller" });
Trade.belongsTo(Currency, { foreignKey: "base_crc_id", as: "baseCurrency" });
Trade.belongsTo(Currency, { foreignKey: "quote_crc_id", as: "quoteCurrency" });

// Transfer
Transfer.belongsTo(User, { foreignKey: "sender_id", as: "sender" });
Transfer.belongsTo(User, { foreignKey: "receiver_id", as: "receiver" });
Transfer.belongsTo(Currency, { foreignKey: "crc_id", as: "currency" });

// IdempotencyKey
IdempotencyKey.belongsTo(User, { foreignKey: "user_id", as: "user" });

module.exports = {
  User,
  Currency,
  Wallet,
  Order,
  Trade,
  Transfer,
  IdempotencyKey,
};
