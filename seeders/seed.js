require("dotenv").config();
const bcrypt = require("bcrypt");
const sequelize = require("../config/database");
const { User, Currency, Wallet, Order, Trade } = require("../models");

async function seed() {
  console.log("Syncing database (force: true) ...");
  await sequelize.sync({ force: true });

  // ===== Currencies =====
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

  // ===== Users =====
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

  // ===== Wallets =====
  // Wallet balances reflect the state AFTER the seeded orders and trades below.
  //
  // Initial balances (before orders/trades):
  //   jane: 500,000 THB | 5,000 USD | 2 BTC    | 10 ETH | 10,000 XRP | 50,000 DOGE
  //   john: 300,000 THB | 3,000 USD | 1 BTC    | 5 ETH  | 5,000 XRP  | 25,000 DOGE
  //   alex: 200,000 THB | 2,000 USD | 0.5 BTC  | 3 ETH  | 3,000 XRP  | 15,000 DOGE
  //
  // Order 1: Jane sells 0.5 BTC @ 100,000 THB/BTC
  //   → Locks 0.5 BTC from Jane's balance
  //
  // Trade 1: John buys 0.3 BTC from Jane's Order 1
  //   → Jane BTC lock released: 0.5 → 0.2 (0.3 transferred to John)
  //   → Jane THB: 500,000 + 30,000 = 530,000  (received payment)
  //   → John THB: 300,000 - 30,000 = 270,000  (paid for 0.3 BTC)
  //   → John BTC: 1 + 0.3 = 1.3               (received crypto)
  //   → Order 1: remain_amount 0.5 → 0.2, status → "partial"
  //
  // Order 2: Alex buys 100 XRP @ 20 THB/XRP (open, no trades yet)
  //   → Locks 100 × 20 = 2,000 THB from Alex's balance

  console.log("Seeding wallets ...");
  const walletData = [
    // Jane — THB +30,000 from trade | BTC: 2 - 0.5 locked + 0.3 released = bal 1.5, lck 0.2
    { owner_id: jane.id, crc_id: THB.id, balance: 530000, balance_lck: 0 },
    { owner_id: jane.id, crc_id: USD.id, balance: 5000, balance_lck: 0 },
    { owner_id: jane.id, crc_id: BTC.id, balance: 1.5, balance_lck: 0.2 },
    { owner_id: jane.id, crc_id: ETH.id, balance: 10, balance_lck: 0 },
    { owner_id: jane.id, crc_id: XRP.id, balance: 10000, balance_lck: 0 },
    { owner_id: jane.id, crc_id: DOGE.id, balance: 50000, balance_lck: 0 },

    // John — THB -30,000 for trade | BTC +0.3 from trade
    { owner_id: john.id, crc_id: THB.id, balance: 270000, balance_lck: 0 },
    { owner_id: john.id, crc_id: USD.id, balance: 3000, balance_lck: 0 },
    { owner_id: john.id, crc_id: BTC.id, balance: 1.3, balance_lck: 0 },
    { owner_id: john.id, crc_id: ETH.id, balance: 5, balance_lck: 0 },
    { owner_id: john.id, crc_id: XRP.id, balance: 5000, balance_lck: 0 },
    { owner_id: john.id, crc_id: DOGE.id, balance: 25000, balance_lck: 0 },

    // Alex — THB: 200,000 - 2,000 locked = bal 198,000, lck 2,000
    {
      owner_id: alex.id,
      crc_id: THB.id,
      balance: 198000,
      balance_lck: 2000,
    },
    { owner_id: alex.id, crc_id: USD.id, balance: 2000, balance_lck: 0 },
    { owner_id: alex.id, crc_id: BTC.id, balance: 0.5, balance_lck: 0 },
    { owner_id: alex.id, crc_id: ETH.id, balance: 3, balance_lck: 0 },
    { owner_id: alex.id, crc_id: XRP.id, balance: 3000, balance_lck: 0 },
    { owner_id: alex.id, crc_id: DOGE.id, balance: 15000, balance_lck: 0 },
  ];
  await Wallet.bulkCreate(walletData);

  // ===== Orders =====
  console.log("Seeding orders ...");

  // Order 1: Jane sells 0.5 BTC @ 100,000 THB/BTC (partially filled: 0.3 traded, 0.2 remaining)
  const order1 = await Order.create({
    user_id: jane.id,
    type: "sell",
    base_crc_id: BTC.id,
    quote_crc_id: THB.id,
    price: 100000,
    amount: 0.5,
    remain_amount: 0.2,
    status: "partial",
  });

  // Order 2: Alex wants to buy 100 XRP @ 20 THB/XRP (open, no trades yet)
  await Order.create({
    user_id: alex.id,
    type: "buy",
    base_crc_id: XRP.id,
    quote_crc_id: THB.id,
    price: 20,
    amount: 100,
    remain_amount: 100,
    status: "open",
  });

  // ===== Trades =====
  console.log("Seeding trades ...");

  // Trade 1: John bought 0.3 BTC from Jane's sell Order 1
  await Trade.create({
    order_id: order1.id,
    buyer_id: john.id,
    seller_id: jane.id,
    base_crc_id: BTC.id,
    quote_crc_id: THB.id,
    price: 100000,
    base_amount: 0.3,
    quote_amount: 30000, // 0.3 × 100,000
    status: "completed",
  });

  console.log("========================================");
  console.log("Seed completed successfully!");
  console.log("========================================");
  console.log("Test accounts (password: password123):");
  console.log("  - jane@example.com");
  console.log("  - john@example.com");
  console.log("  - alex@example.com");
  console.log("========================================");
  console.log("Sample data:");
  console.log(
    "  - Order 1: Jane sells 0.5 BTC @ 100,000 THB (partial, 0.2 remaining)",
  );
  console.log("  - Order 2: Alex buys 100 XRP @ 20 THB (open)");
  console.log(
    "  - Trade 1: John bought 0.3 BTC from Jane @ 100,000 THB/BTC",
  );
  console.log("========================================");

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
