const express = require("express");
const router = express.Router();
const AuthController = require("../controllers/AuthController");
const OrderController = require("../controllers/OrderController");
const TradeController = require("../controllers/TradeController");
const WalletController = require("../controllers/WalletController");
const verifyToken = require("../middleware/auth");
const idempotency = require("../middleware/idempotency");

// ===== Auth =====

/**
 * @openapi
 * /api/register:
 *   post:
 *     summary: Register new account
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, email, password]
 *             properties:
 *               username: { type: string, example: "[NAME]" }
 *               email: { type: string, example: "[EMAIL_ADDRESS]" }
 *               password: { type: string, example: "[PASSWORD]" }
 *     responses:
 *       201:
 *         description: Registration successful
 *       400:
 *         description: Validation error (e.g. username too short, password too short)
 *       409:
 *         description: Email already registered
 */
router.post("/register", AuthController.register);

/**
 * @openapi
 * /api/login:
 *   post:
 *     summary: Login to receive JWT token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, example: "[EMAIL_ADDRESS]" }
 *               password: { type: string, example: "[PASSWORD]" }
 *     responses:
 *       200:
 *         description: Login successful, returns JWT token
 *       401:
 *         description: Invalid credentials
 */
router.post("/login", AuthController.login);

// ===== Orders =====

/**
 * @openapi
 * /api/orders:
 *   get:
 *     summary: Get all orders
 *     tags: [Orders]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [buy, sell] }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [open, partial, completed, cancelled] }
 *     responses:
 *       200:
 *         description: List of orders
 */
router.get("/orders", OrderController.getAllOrders);

/**
 * @openapi
 * /api/orders/{id}:
 *   get:
 *     summary: Get a single order by ID
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Order details with user and currency info
 *       404:
 *         description: Order not found
 */
router.get("/orders/:id", OrderController.getOrderById);

/**
 * @openapi
 * /api/orders:
 *   post:
 *     summary: Create a new buy or sell order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: X-Idempotency-Key
 *         required: false
 *         schema:
 *           type: string
 *         description: Optional unique idempotency key to prevent double submission
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, base_crc_id, quote_crc_id, price, amount]
 *             properties:
 *               type: { type: string, enum: [buy, sell] }
 *               base_crc_id: { type: integer }
 *               quote_crc_id: { type: integer }
 *               price: { type: number }
 *               amount: { type: number }
 *     responses:
 *       201:
 *         description: Order created
 *       400:
 *         description: Insufficient balance or invalid input
 *       409:
 *         description: Concurrent or duplicate request in progress
 *       429:
 *         description: Duplicate submission detected
 */
router.post("/orders", verifyToken, idempotency(), OrderController.createOrder);

/**
 * @openapi
 * /api/orders/{id}/cancel:
 *   patch:
 *     summary: Cancel an order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Order cancelled, locked funds released back to available balance
 *       400:
 *         description: Order cannot be cancelled (already completed or cancelled)
 *       403:
 *         description: Not your order
 *       404:
 *         description: Order not found
 */
router.patch("/orders/:id/cancel", verifyToken, OrderController.cancelOrder);

// ===== Trades =====

/**
 * @openapi
 * /api/orders/{id}/trade:
 *   post:
 *     summary: Accept an order and complete the trade
 *     tags: [Trades]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: header
 *         name: X-Idempotency-Key
 *         required: false
 *         schema:
 *           type: string
 *         description: Optional unique idempotency key to prevent double trade execution
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount: { type: number, description: "Partial amount (optional, defaults to full remaining)" }
 *     responses:
 *       201:
 *         description: Trade completed, funds exchanged
 *       400:
 *         description: Insufficient balance or order unavailable
 *       409:
 *         description: Concurrent request in progress
 */
router.post(
  "/orders/:id/trade",
  verifyToken,
  idempotency(),
  TradeController.executeTrade
);

/**
 * @openapi
 * /api/trades:
 *   get:
 *     summary: Get all user's trades
 *     tags: [Trades]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of trades (as buyer or seller)
 */
router.get("/trades", verifyToken, TradeController.getUserTrades);

// ===== Wallets & Transfers =====

/**
 * @openapi
 * /api/wallets:
 *   get:
 *     summary: Get all user's wallets
 *     tags: [Wallets]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of wallets with balances
 */
router.get("/wallets", verifyToken, WalletController.getMyWallets);

/**
 * @openapi
 * /api/transfers:
 *   post:
 *     summary: Transfer coins internally or externally
 *     tags: [Transfers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: X-Idempotency-Key
 *         required: false
 *         schema:
 *           type: string
 *         description: Optional unique idempotency key to prevent double transfer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [crc_id, amount]
 *             properties:
 *               to_username: { type: string, description: "Recipient username (for internal transfer)" }
 *               recipient_address: { type: string, description: "Blockchain/bank address (for external transfer)" }
 *               crc_id: { type: integer }
 *               amount: { type: number }
 *     responses:
 *       201:
 *         description: Transfer successful
 *       400:
 *         description: Insufficient balance or below minimum withdrawal
 *       409:
 *         description: Concurrent request in progress
 */
router.post("/transfers", verifyToken, idempotency(), WalletController.transfer);

/**
 * @openapi
 * /api/transfers:
 *   get:
 *     summary: Get user's transfer history 
 *     tags: [Transfers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of transfers (sent and received)
 */
router.get("/transfers", verifyToken, WalletController.getTransferHistory);

module.exports = router;
