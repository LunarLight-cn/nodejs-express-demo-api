const express = require("express");
const router = express.Router();
const AuthController = require("../controllers/AuthController");
const OrderController = require("../controllers/OrderController");
const TradeController = require("../controllers/TradeController");
const WalletController = require("../controllers/WalletController");
const verifyToken = require("../middleware/auth");

//  Authorization

/**
 * @openapi
 * /api/register:
 *   post:
 *     summary: Register a new user account
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, email, password]
 *             properties:
 *               username: { type: string, example: "amy" }
 *               email: { type: string, example: "EMAIL_ADDRESS" }
 *               password: { type: string, example: "PASSWORD" }
 *     responses:
 *       201:
 *         description: Registration successful
 *       409:
 *         description: Email already registered
 */
router.post("/register", AuthController.register);

/**
 * @openapi
 * /api/login:
 *   post:
 *     summary: Login and receive a JWT token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, example: "EMAIL_ADDRESS" }
 *               password: { type: string, example: "PASSWORD" }
 *     responses:
 *       200:
 *         description: Login successful, returns JWT token
 *       401:
 *         description: Invalid credentials
 */
router.post("/login", AuthController.login);

// Order

/**
 * @openapi
 * /api/getAllOrders:
 *   get:
 *     summary: Get all orders (supports filtering by type and status)
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
router.get("/getAllOrders", OrderController.getAllOrders);

/**
 * @openapi
 * /api/createOrder:
 *   post:
 *     summary: Create a new buy or sell order (requires token)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, base_crc_id, quote_crc_id, price, amount]
 *             properties:
 *               type: { type: string, enum: [buy, sell] }
 *               base_crc_id: { type: integer}
 *               quote_crc_id: { type: integer}
 *               price: { type: number}
 *               amount: { type: number}
 *     responses:
 *       201:
 *         description: Order created
 *       400:
 *         description: Insufficient balance or invalid input
 */
router.post("/createOrder", verifyToken, OrderController.createOrder);

// Trade

/**
 * @openapi
 * /api/orders/{id}/trade:
 *   post:
 *     summary: Accept an order and complete the trade instantly (requires token)
 *     tags: [Trades]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
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
 */
router.post("/orders/:id/trade", verifyToken, TradeController.executeTrade);

/**
 * @openapi
 * /api/getUserTrades:
 *   get:
 *     summary: Get all trades for the authenticated user (requires token)
 *     tags: [Trades]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of trades
 */
router.get("/getUserTrades", verifyToken, TradeController.getUserTrades);

// Wallet 

/**
 * @openapi
 * /api/getMyWallets:
 *   get:
 *     summary: Get all wallets for the authenticated user (requires token)
 *     tags: [Wallets]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of wallets with balances
 */
router.get("/getMyWallets", verifyToken, WalletController.getMyWallets);

/**
 * @openapi
 * /api/transfer:
 *   post:
 *     summary: Transfer coins internally or externally (requires token)
 *     tags: [Wallets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [crc_id, amount]
 *             properties:
 *               to_username: { type: string, description: "Recipient username (internal transfer), Null if external transfer" }
 *               recipient_address: { type: string, description: "Bank or blockchain address (external transfer), Null if internal transfer" }
 *               crc_id: { type: integer }
 *               amount: { type: number }
 *     responses:
 *       201:
 *         description: Transfer successful
 *       400:
 *         description: Insufficient balance
 */
router.post("/transfer", verifyToken, WalletController.transfer);

/**
 * @openapi
 * /api/getTransferHistory:
 *   get:
 *     summary: Get transfer history for the authenticated user (requires token)
 *     tags: [Wallets]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of transfers
 */
router.get("/getTransferHistory", verifyToken, WalletController.getTransferHistory);

module.exports = router;
