require("dotenv").config();
const bcrypt = require("bcrypt");
const sequelize = require("../config/database");
const { User, Currency, Wallet, Order, Trade } = require("../models");

async function seed() {
  console.log("Syncing database (force: true) ...");
  await sequelize.sync({ force: true });

  console.log("Seeding currencies ...");
  const currencies = await Currency.bulkCreate([
    {
      code: "THB",
      type: "fiat",
      decimal: 2,
      min_withdraw: 100,
      is_active: true,
    },
    {
      code: "USD",
      type: "fiat",
      decimal: 2,
      min_withdraw: 10,
      is_active: true,
    },
    {
      code: "BTC",
      type: "crypto",
      decimal: 8,
      min_withdraw: 0.0001,
      is_active: true,
    },
    {
      code: "ETH",
      type: "crypto",
      decimal: 8,
      min_withdraw: 0.001,
      is_active: true,
    },
    {
      code: "XRP",
      type: "crypto",
      decimal: 6,
      min_withdraw: 1,
      is_active: true,
    },
    {
      code: "DOGE",
      type: "crypto",
      decimal: 4,
      min_withdraw: 10,
      is_active: true,
    },
  ]);

  const [THB, USD, BTC, ETH, XRP, DOGE] = currencies;

  console.log("Seeding users ...");
  const passHash = await bcrypt.hash("password123", 10);

  const jane = await User.create({
    username: "jane",
    email: "jane@example.com",
    pass_hash: passHash,
  });

  const john = await User.create({
    username: "john",
    email: "john@example.com",
    pass_hash: passHash,
  });

  const alex = await User.create({
    username: "alex",
    email: "alex@example.com",
    pass_hash: passHash,
  });

  console.log("Seeding wallets ...");
  const walletData = [];
  const users = [jane, john, alex];
  const initialBalances = {
    [jane.id]: {
      THB: 500000,
      USD: 5000,
      BTC: 2,
      ETH: 10,
      XRP: 10000,
      DOGE: 50000,
    },
    [john.id]: {
      THB: 300000,
      USD: 3000,
      BTC: 1,
      ETH: 5,
      XRP: 5000,
      DOGE: 25000,
    },
    [alex.id]: {
      THB: 200000,
      USD: 2000,
      BTC: 0.5,
      ETH: 3,
      XRP: 3000,
      DOGE: 15000,
    },
  };

  for (const user of users) {
    for (const currency of currencies) {
      walletData.push({
        owner_id: user.id,
        crc_id: currency.id,
        balance: initialBalances[user.id][currency.code] || 0,
        balance_lck: 0,
      });
    }
  }

  await Wallet.bulkCreate(walletData);

  console.log("========================================");
  console.log("Seed completed successfully!");
  console.log("========================================");
  console.log("Test accounts (password: password123):");
  console.log("  - jane@example.com");
  console.log("  - john@example.com");
  console.log("  - alex@example.com");
  console.log("========================================");

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
