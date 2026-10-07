const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../app");
const sequelize = require("../config/database");
const { User, Currency, Wallet, Order, Trade, Transfer, IdempotencyKey } = require("../models");
const bcrypt = require("bcrypt");

describe("Crypto C2C Exchange - Comprehensive API Test Suite", () => {
  let janeToken;
  let johnToken;
  let alexToken;
  let btcId;
  let thbId;
  let xrpId;

  // Reset and seed database before running all tests
  before(async () => {
    await sequelize.sync({ force: true });

    // Seed currencies
    const currencies = await Currency.bulkCreate([
      { code: "THB", type: "fiat", decimal: 2, min_withdraw: 100, is_active: true },
      { code: "USD", type: "fiat", decimal: 2, min_withdraw: 10, is_active: true },
      { code: "BTC", type: "crypto", decimal: 8, min_withdraw: 0.0001, is_active: true },
      { code: "ETH", type: "crypto", decimal: 8, min_withdraw: 0.001, is_active: true },
      { code: "XRP", type: "crypto", decimal: 6, min_withdraw: 1, is_active: true },
    ]);

    thbId = currencies.find((c) => c.code === "THB").id;
    btcId = currencies.find((c) => c.code === "BTC").id;
    xrpId = currencies.find((c) => c.code === "XRP").id;

    // Seed users
    const hash = await bcrypt.hash("password123", 10);
    const users = await User.bulkCreate([
      { username: "jane", email: "jane@example.com", pass_hash: hash },
      { username: "john", email: "john@example.com", pass_hash: hash },
      { username: "alex", email: "alex@example.com", pass_hash: hash },
    ]);

    const [jane, john, alex] = users;

    // Seed initial wallets with rich balances for testing
    await Wallet.bulkCreate([
      // Jane
      { owner_id: jane.id, crc_id: thbId, balance: 500000, balance_lck: 0 },
      { owner_id: jane.id, crc_id: btcId, balance: 2.0, balance_lck: 0 },
      { owner_id: jane.id, crc_id: xrpId, balance: 1000, balance_lck: 0 },
      // John
      { owner_id: john.id, crc_id: thbId, balance: 200000, balance_lck: 0 },
      { owner_id: john.id, crc_id: btcId, balance: 0.5, balance_lck: 0 },
      { owner_id: john.id, crc_id: xrpId, balance: 500, balance_lck: 0 },
      // Alex
      { owner_id: alex.id, crc_id: thbId, balance: 100000, balance_lck: 0 },
      { owner_id: alex.id, crc_id: btcId, balance: 0.1, balance_lck: 0 },
      { owner_id: alex.id, crc_id: xrpId, balance: 200, balance_lck: 0 },
    ]);

    // Obtain tokens
    const resJane = await request(app).post("/api/login").send({
      email: "jane@example.com",
      password: "password123",
    });
    janeToken = resJane.body.token;

    const resJohn = await request(app).post("/api/login").send({
      email: "john@example.com",
      password: "password123",
    });
    johnToken = resJohn.body.token;

    const resAlex = await request(app).post("/api/login").send({
      email: "alex@example.com",
      password: "password123",
    });
    alexToken = resAlex.body.token;
  });

  after(async () => {
    // Teardown connections
    await sequelize.close();
  });

  // ==========================================
  // 1. AUTHENTICATION APIS
  // ==========================================
  describe("1. Authentication APIs", () => {
    it("POST /api/register - should register a new user successfully", async () => {
      const res = await request(app).post("/api/register").send({
        username: "testuser",
        email: "testuser@example.com",
        password: "secretpassword",
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.message, "Registration successful");
      assert.equal(res.body.user.username, "testuser");
      assert.equal(res.body.user.email, "testuser@example.com");

      // Verify user wallets were automatically created
      const wallets = await Wallet.findAll({ where: { owner_id: res.body.user.id } });
      assert.ok(wallets.length >= 5);
    });

    it("POST /api/register - should reject duplicate email", async () => {
      const res = await request(app).post("/api/register").send({
        username: "newname",
        email: "jane@example.com",
        password: "password123",
      });

      assert.equal(res.status, 409);
      assert.match(res.body.error, /already registered/i);
    });

    it("POST /api/register - should reject short password or missing fields", async () => {
      const res1 = await request(app).post("/api/register").send({
        username: "ab",
        email: "short@example.com",
        password: "123",
      });
      assert.equal(res1.status, 400);

      const res2 = await request(app).post("/api/register").send({
        email: "incomplete@example.com",
      });
      assert.equal(res2.status, 400);
    });

    it("POST /api/login - should authenticate valid user and return JWT", async () => {
      const res = await request(app).post("/api/login").send({
        email: "jane@example.com",
        password: "password123",
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.message, "Login successful");
      assert.ok(typeof res.body.token === "string");
    });

    it("POST /api/login - should reject invalid credentials", async () => {
      const res1 = await request(app).post("/api/login").send({
        email: "jane@example.com",
        password: "wrongpassword",
      });
      assert.equal(res1.status, 401);

      const res2 = await request(app).post("/api/login").send({
        email: "nonexistent@example.com",
        password: "password123",
      });
      assert.equal(res2.status, 401);
    });
  });

  // ==========================================
  // 2. WALLET APIS
  // ==========================================
  describe("2. Wallet APIs", () => {
    it("GET /api/wallets - should reject request without token", async () => {
      const res = await request(app).get("/api/wallets");
      assert.equal(res.status, 403);
    });

    it("GET /api/wallets - should return user wallets with currency information", async () => {
      const res = await request(app)
        .get("/api/wallets")
        .set("Authorization", `Bearer ${janeToken}`);

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body));
      const btcWallet = res.body.find((w) => w.currency.code === "BTC");
      assert.ok(btcWallet);
      assert.equal(parseFloat(btcWallet.balance), 2.0);
    });
  });

  // ==========================================
  // 3. TRANSFER APIS
  // ==========================================
  describe("3. Transfer APIs", () => {
    it("POST /api/transfers - should execute internal transfer successfully", async () => {
      const res = await request(app)
        .post("/api/transfers")
        .set("Authorization", `Bearer ${janeToken}`)
        .send({
          to_username: "john",
          crc_id: thbId,
          amount: 5000,
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.message, "Transfer successful");
      assert.equal(res.body.transfer.type, "internal");
      assert.equal(parseFloat(res.body.transfer.amount), 5000);

      // Verify recipient received funds
      const johnWallet = await Wallet.findOne({
        where: { owner_id: 2, crc_id: thbId },
      });
      assert.equal(parseFloat(johnWallet.balance), 205000);
    });

    it("POST /api/transfers - should reject transfer to oneself", async () => {
      const res = await request(app)
        .post("/api/transfers")
        .set("Authorization", `Bearer ${janeToken}`)
        .send({
          to_username: "jane",
          crc_id: thbId,
          amount: 100,
        });

      assert.equal(res.status, 400);
      assert.match(res.body.error, /yourself/i);
    });

    it("POST /api/transfers - should reject transfer exceeding balance", async () => {
      const res = await request(app)
        .post("/api/transfers")
        .set("Authorization", `Bearer ${alexToken}`)
        .send({
          to_username: "john",
          crc_id: btcId,
          amount: 999.0,
        });

      assert.equal(res.status, 400);
      assert.match(res.body.error, /insufficient/i);
    });

    it("POST /api/transfers - should execute external transfer with minimum check", async () => {
      // Below min withdrawal: min is 0.0001 BTC
      const resBelow = await request(app)
        .post("/api/transfers")
        .set("Authorization", `Bearer ${janeToken}`)
        .send({
          recipient_address: "0x1234567890abcdef",
          crc_id: btcId,
          amount: 0.00001,
        });
      assert.equal(resBelow.status, 400);
      assert.match(resBelow.body.error, /minimum withdrawal/i);

      // Valid external transfer
      const resValid = await request(app)
        .post("/api/transfers")
        .set("Authorization", `Bearer ${janeToken}`)
        .send({
          recipient_address: "0x1234567890abcdef",
          crc_id: btcId,
          amount: 0.05,
        });
      assert.equal(resValid.status, 201);
      assert.equal(resValid.body.transfer.type, "external");
    });

    it("GET /api/transfers - should return user transfer history", async () => {
      const res = await request(app)
        .get("/api/transfers")
        .set("Authorization", `Bearer ${janeToken}`);

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body));
      assert.ok(res.body.length >= 2);
    });
  });

  // ==========================================
  // 4. ORDER APIS
  // ==========================================
  describe("4. Order APIs", () => {
    let createdOrderId;

    it("POST /api/orders - should create a sell order and lock base currency", async () => {
      const res = await request(app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${janeToken}`)
        .send({
          type: "sell",
          base_crc_id: btcId,
          quote_crc_id: thbId,
          price: 150000,
          amount: 0.5,
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.message, "Order created successfully");
      assert.equal(res.body.order.status, "open");
      assert.equal(parseFloat(res.body.order.remain_amount), 0.5);

      createdOrderId = res.body.order.id;

      // Verify 0.5 BTC is locked in Jane's wallet
      const janeBtc = await Wallet.findOne({ where: { owner_id: 1, crc_id: btcId } });
      assert.equal(parseFloat(janeBtc.balance_lck), 0.5);
    });

    it("POST /api/orders - should create a buy order and lock quote currency", async () => {
      // John buys 0.1 BTC @ 100,000 THB = 10,000 THB locked
      const res = await request(app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${johnToken}`)
        .send({
          type: "buy",
          base_crc_id: btcId,
          quote_crc_id: thbId,
          price: 100000,
          amount: 0.1,
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.order.type, "buy");

      // Verify John locked 10,000 THB
      const johnThb = await Wallet.findOne({ where: { owner_id: 2, crc_id: thbId } });
      assert.equal(parseFloat(johnThb.balance_lck), 10000);
    });

    it("POST /api/orders - should validate input and reject invalid orders", async () => {
      // Same currency
      const resSame = await request(app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${janeToken}`)
        .send({
          type: "sell",
          base_crc_id: btcId,
          quote_crc_id: btcId,
          price: 100,
          amount: 1,
        });
      assert.equal(resSame.status, 400);

      // Negative amount
      const resNeg = await request(app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${janeToken}`)
        .send({
          type: "sell",
          base_crc_id: btcId,
          quote_crc_id: thbId,
          price: 100,
          amount: -5,
        });
      assert.equal(resNeg.status, 400);

      // Insufficient balance
      const resBroke = await request(app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${alexToken}`)
        .send({
          type: "sell",
          base_crc_id: btcId,
          quote_crc_id: thbId,
          price: 100000,
          amount: 99.0,
        });
      assert.equal(resBroke.status, 400);
      assert.match(resBroke.body.error, /insufficient balance/i);
    });

    it("GET /api/orders - should list all orders and support filtering", async () => {
      const resAll = await request(app).get("/api/orders");
      assert.equal(resAll.status, 200);
      assert.ok(resAll.body.length >= 2);

      const resFiltered = await request(app).get("/api/orders?type=sell&status=open");
      assert.equal(resFiltered.status, 200);
      assert.ok(resFiltered.body.every((o) => o.type === "sell" && o.status === "open"));
    });

    it("GET /api/orders/:id - should get single order by ID or return 404", async () => {
      const res = await request(app).get(`/api/orders/${createdOrderId}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.id, createdOrderId);
      assert.ok(res.body.baseCurrency);

      const res404 = await request(app).get("/api/orders/99999");
      assert.equal(res404.status, 404);
    });

    it("PATCH /api/orders/:id/cancel - should reject cancelling other user's order", async () => {
      const res = await request(app)
        .patch(`/api/orders/${createdOrderId}/cancel`)
        .set("Authorization", `Bearer ${johnToken}`);

      assert.equal(res.status, 403);
      assert.match(res.body.error, /only cancel your own/i);
    });

    it("PATCH /api/orders/:id/cancel - should cancel order and refund locked balance", async () => {
      // Jane cancels her sell order of 0.5 BTC
      const preWallet = await Wallet.findOne({ where: { owner_id: 1, crc_id: btcId } });
      const preAvail = parseFloat(preWallet.balance);
      const preLck = parseFloat(preWallet.balance_lck);

      const res = await request(app)
        .patch(`/api/orders/${createdOrderId}/cancel`)
        .set("Authorization", `Bearer ${janeToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.order.status, "cancelled");

      const postWallet = await Wallet.findOne({ where: { owner_id: 1, crc_id: btcId } });
      assert.equal(parseFloat(postWallet.balance), preAvail + 0.5);
      assert.equal(parseFloat(postWallet.balance_lck), preLck - 0.5);

      // Re-cancelling should fail
      const resRepeat = await request(app)
        .patch(`/api/orders/${createdOrderId}/cancel`)
        .set("Authorization", `Bearer ${janeToken}`);
      assert.equal(resRepeat.status, 400);
    });
  });

  // ==========================================
  // 5. TRADING APIS
  // ==========================================
  describe("5. Trading APIs", () => {
    let activeSellOrderId;

    before(async () => {
      // Jane creates a fresh sell order: 0.3 BTC @ 100,000 THB = 30,000 THB
      const res = await request(app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${janeToken}`)
        .send({
          type: "sell",
          base_crc_id: btcId,
          quote_crc_id: thbId,
          price: 100000,
          amount: 0.3,
        });
      activeSellOrderId = res.body.order.id;
    });

    it("POST /api/orders/:id/trade - should reject trading with one's own order", async () => {
      const res = await request(app)
        .post(`/api/orders/${activeSellOrderId}/trade`)
        .set("Authorization", `Bearer ${janeToken}`)
        .send({ amount: 0.1 });

      assert.equal(res.status, 400);
      assert.match(res.body.error, /cannot trade with your own order/i);
    });

    it("POST /api/orders/:id/trade - should execute partial trade and transfer funds", async () => {
      // John buys 0.1 BTC from Jane's 0.3 BTC order
      const johnThbPre = await Wallet.findOne({ where: { owner_id: 2, crc_id: thbId } });
      const johnBtcPre = await Wallet.findOne({ where: { owner_id: 2, crc_id: btcId } });
      const janeThbPre = await Wallet.findOne({ where: { owner_id: 1, crc_id: thbId } });

      const res = await request(app)
        .post(`/api/orders/${activeSellOrderId}/trade`)
        .set("Authorization", `Bearer ${johnToken}`)
        .send({ amount: 0.1 });

      assert.equal(res.status, 201);
      assert.equal(res.body.message, "Trade completed successfully");
      assert.equal(parseFloat(res.body.trade.base_amount), 0.1);
      assert.equal(parseFloat(res.body.trade.quote_amount), 10000);

      // Verify order status updated to 'partial' with remain_amount = 0.2
      const updatedOrder = await Order.findByPk(activeSellOrderId);
      assert.equal(updatedOrder.status, "partial");
      assert.equal(parseFloat(updatedOrder.remain_amount), 0.2);

      // Verify John spent 10,000 THB and gained 0.1 BTC
      const johnThbPost = await Wallet.findOne({ where: { owner_id: 2, crc_id: thbId } });
      const johnBtcPost = await Wallet.findOne({ where: { owner_id: 2, crc_id: btcId } });
      assert.equal(parseFloat(johnThbPost.balance), parseFloat(johnThbPre.balance) - 10000);
      assert.equal(parseFloat(johnBtcPost.balance), parseFloat(johnBtcPre.balance) + 0.1);

      // Verify Jane received 10,000 THB
      const janeThbPost = await Wallet.findOne({ where: { owner_id: 1, crc_id: thbId } });
      assert.equal(parseFloat(janeThbPost.balance), parseFloat(janeThbPre.balance) + 10000);
    });

    it("POST /api/orders/:id/trade - should complete remaining order (full fill)", async () => {
      // Alex buys the remaining 0.2 BTC
      const res = await request(app)
        .post(`/api/orders/${activeSellOrderId}/trade`)
        .set("Authorization", `Bearer ${alexToken}`)
        .send(); // defaults to remaining amount

      assert.equal(res.status, 201);
      assert.equal(parseFloat(res.body.trade.base_amount), 0.2);

      const completedOrder = await Order.findByPk(activeSellOrderId);
      assert.equal(completedOrder.status, "completed");
      assert.equal(parseFloat(completedOrder.remain_amount), 0);

      // Attempting to trade completed order should fail
      const resAgain = await request(app)
        .post(`/api/orders/${activeSellOrderId}/trade`)
        .set("Authorization", `Bearer ${johnToken}`)
        .send({ amount: 0.05 });
      assert.equal(resAgain.status, 400);
    });

    it("GET /api/trades - should return user trade history", async () => {
      const res = await request(app)
        .get("/api/trades")
        .set("Authorization", `Bearer ${johnToken}`);

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body));
      assert.ok(res.body.length >= 1);
      assert.equal(res.body[0].status, "completed");
    });
  });

  // ==========================================
  // 6. IDEMPOTENCY & DOUBLE ORDER PROTECTION
  // ==========================================
  describe("6. Double-Order & Idempotency Protection", () => {
    it("POST /api/orders - should prevent double order via X-Idempotency-Key", async () => {
      const uniqueKey = `idemp-order-${Date.now()}`;
      const payload = {
        type: "sell",
        base_crc_id: btcId,
        quote_crc_id: thbId,
        price: 120000,
        amount: 0.05,
      };

      const res1 = await request(app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${janeToken}`)
        .set("X-Idempotency-Key", uniqueKey)
        .send(payload);

      assert.equal(res1.status, 201);
      const firstOrderId = res1.body.order.id;

      // Re-send exactly same request with same key
      const res2 = await request(app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${janeToken}`)
        .set("X-Idempotency-Key", uniqueKey)
        .send(payload);

      assert.equal(res2.status, 201);
      assert.equal(res2.headers["x-cache-lookup"], "HIT-IDEMPOTENT");
      assert.equal(res2.body.order.id, firstOrderId);

      // Verify no extra order was inserted
      const count = await Order.count({ where: { user_id: 1, price: 120000 } });
      assert.equal(count, 1);
    });

    it("POST /api/orders - should reject same idempotency key with different payload", async () => {
      const uniqueKey = `idemp-mismatch-${Date.now()}`;
      await request(app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${janeToken}`)
        .set("X-Idempotency-Key", uniqueKey)
        .send({
          type: "sell",
          base_crc_id: btcId,
          quote_crc_id: thbId,
          price: 130000,
          amount: 0.05,
        });

      // Send different amount with same key
      const resMismatch = await request(app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${janeToken}`)
        .set("X-Idempotency-Key", uniqueKey)
        .send({
          type: "sell",
          base_crc_id: btcId,
          quote_crc_id: thbId,
          price: 130000,
          amount: 0.08,
        });

      assert.equal(resMismatch.status, 422);
      assert.match(resMismatch.body.error, /different request payload/i);
    });

    it("POST /api/orders - should auto-debounce rapid identical submissions without header", async () => {
      const payload = {
        type: "sell",
        base_crc_id: btcId,
        quote_crc_id: thbId,
        price: 140000,
        amount: 0.02,
      };

      const [p1, p2] = await Promise.all([
        request(app)
          .post("/api/orders")
          .set("Authorization", `Bearer ${janeToken}`)
          .send(payload),
        request(app)
          .post("/api/orders")
          .set("Authorization", `Bearer ${janeToken}`)
          .send(payload),
      ]);

      const successCount = [p1, p2].filter((r) => r.status === 201).length;
      const blockedCount = [p1, p2].filter((r) => r.status === 409 || r.status === 429).length;

      assert.equal(successCount, 1);
      assert.equal(blockedCount, 1);
    });

    it("POST /api/orders/:id/trade - should serialize concurrent trades and prevent over-fill", async () => {
      // Alex places order to sell 0.03 BTC
      const orderRes = await request(app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${alexToken}`)
        .set("X-Idempotency-Key", `alex-sell-${Date.now()}`)
        .send({
          type: "sell",
          base_crc_id: btcId,
          quote_crc_id: thbId,
          price: 100000,
          amount: 0.03,
        });
      const orderId = orderRes.body.order.id;

      // Jane and John both attempt to buy the entire 0.03 BTC concurrently
      const [t1, t2] = await Promise.all([
        request(app)
          .post(`/api/orders/${orderId}/trade`)
          .set("Authorization", `Bearer ${janeToken}`)
          .send({ amount: 0.03 }),
        request(app)
          .post(`/api/orders/${orderId}/trade`)
          .set("Authorization", `Bearer ${johnToken}`)
          .send({ amount: 0.03 }),
      ]);

      const targetOrder = await Order.findByPk(orderId);
      assert.ok(parseFloat(targetOrder.remain_amount) >= 0);
      assert.equal(targetOrder.status, "completed");

      // Total executed amount across all trades on this order must equal exactly 0.03 BTC
      const trades = await Trade.findAll({ where: { order_id: orderId } });
      const totalTraded = trades.reduce((sum, tr) => sum + parseFloat(tr.base_amount), 0);
      assert.equal(totalTraded, 0.03);
    });
  });
});
