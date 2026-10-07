const { Order, User, Currency, Wallet } = require("../models");
const sequelize = require("../config/database");
const DecimalUtil = require("../utils/decimal");

const OrderController = {
  // Get all orders with user and currency details.
  getAllOrders: async (req, res) => {
    try {
      const where = {};
      if (req.query.type) where.type = req.query.type;
      if (req.query.status) where.status = req.query.status;

      const orders = await Order.findAll({
        where,
        include: [
          { model: User, as: "user", attributes: ["id", "username"] },
          {
            model: Currency,
            as: "baseCurrency",
            attributes: ["id", "code", "type"],
          },
          {
            model: Currency,
            as: "quoteCurrency",
            attributes: ["id", "code", "type"],
          },
        ],
        order: [["cdate", "DESC"]],
      });

      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Get a single order by ID with related data.
  getOrderById: async (req, res) => {
    try {
      const order = await Order.findByPk(req.params.id, {
        include: [
          { model: User, as: "user", attributes: ["id", "username"] },
          {
            model: Currency,
            as: "baseCurrency",
            attributes: ["id", "code", "type"],
          },
          {
            model: Currency,
            as: "quoteCurrency",
            attributes: ["id", "code", "type"],
          },
        ],
      });

      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      res.json(order);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Create a new buy or sell order.
  // For sell orders: locks the seller's base currency balance.
  // For buy orders: locks the buyer's quote currency balance.
  createOrder: async (req, res) => {
    const t = await sequelize.transaction();
    try {
      const { type, base_crc_id, quote_crc_id, price, amount } = req.body;
      const user_id = req.user.id;

      if (!type || !base_crc_id || !quote_crc_id || !price || !amount) {
        await t.rollback();
        return res.status(400).json({
          error:
            "type, base_crc_id, quote_crc_id, price, and amount are required",
        });
      }

      if (!["buy", "sell"].includes(type)) {
        await t.rollback();
        return res
          .status(400)
          .json({ error: "type must be 'buy' or 'sell'" });
      }

      if (!DecimalUtil.isPositive(price)) {
        await t.rollback();
        return res
          .status(400)
          .json({ error: "price must be a positive number" });
      }

      if (!DecimalUtil.isPositive(amount)) {
        await t.rollback();
        return res
          .status(400)
          .json({ error: "amount must be a positive number" });
      }

      if (parseInt(base_crc_id, 10) === parseInt(quote_crc_id, 10)) {
        await t.rollback();
        return res
          .status(400)
          .json({ error: "Base and quote currencies must be different" });
      }

      // Verify currencies exist
      const baseCurrency = await Currency.findByPk(base_crc_id, {
        transaction: t,
      });
      const quoteCurrency = await Currency.findByPk(quote_crc_id, {
        transaction: t,
      });

      if (!baseCurrency || !quoteCurrency) {
        await t.rollback();
        return res.status(404).json({ error: "Currency not found" });
      }

      // Determine which wallet to lock funds from
      const lockCrcId = type === "sell" ? base_crc_id : quote_crc_id;
      const lockAmount =
        type === "sell"
          ? String(amount)
          : DecimalUtil.times(price, amount);

      const wallet = await Wallet.findOne({
        where: { owner_id: user_id, crc_id: lockCrcId },
        transaction: t,
        lock: true,
      });

      if (!wallet || DecimalUtil.isLessThan(wallet.balance, lockAmount)) {
        await t.rollback();
        return res.status(400).json({ error: "Insufficient balance" });
      }

      // Lock funds atomically using precise decimal operations
      wallet.balance = DecimalUtil.minus(wallet.balance, lockAmount);
      wallet.balance_lck = DecimalUtil.plus(wallet.balance_lck, lockAmount);
      await wallet.save({ transaction: t });

      // Create the order
      const order = await Order.create(
        {
          user_id,
          type,
          base_crc_id,
          quote_crc_id,
          price: String(price),
          amount: String(amount),
          remain_amount: String(amount),
          status: "open",
        },
        { transaction: t },
      );

      await t.commit();
      res.status(201).json({ message: "Order created successfully", order });
    } catch (error) {
      await t.rollback();
      res.status(500).json({ error: error.message });
    }
  },

  // Cancel an order and release locked funds back to available balance.
  cancelOrder: async (req, res) => {
    const t = await sequelize.transaction();
    try {
      const orderId = req.params.id;
      const userId = req.user.id;

      const order = await Order.findByPk(orderId, {
        transaction: t,
        lock: true,
      });

      if (!order) {
        await t.rollback();
        return res.status(404).json({ error: "Order not found" });
      }

      if (order.user_id !== userId) {
        await t.rollback();
        return res
          .status(403)
          .json({ error: "You can only cancel your own orders" });
      }

      if (order.status !== "open" && order.status !== "partial") {
        await t.rollback();
        return res
          .status(400)
          .json({ error: "Only open or partial orders can be cancelled" });
      }

      // Calculate remaining locked amount to release
      const lockCrcId =
        order.type === "sell" ? order.base_crc_id : order.quote_crc_id;
      const lockAmount =
        order.type === "sell"
          ? String(order.remain_amount)
          : DecimalUtil.times(order.remain_amount, order.price);

      // Release locked funds back to available balance
      const wallet = await Wallet.findOne({
        where: { owner_id: userId, crc_id: lockCrcId },
        transaction: t,
        lock: true,
      });

      if (!wallet || DecimalUtil.isLessThan(wallet.balance_lck, lockAmount)) {
        await t.rollback();
        return res
          .status(400)
          .json({ error: "Insufficient locked funds to release" });
      }

      wallet.balance = DecimalUtil.plus(wallet.balance, lockAmount);
      wallet.balance_lck = DecimalUtil.minus(wallet.balance_lck, lockAmount);
      await wallet.save({ transaction: t });

      // Update order status
      order.status = "cancelled";
      await order.save({ transaction: t });

      await t.commit();
      res.json({ message: "Order cancelled successfully", order });
    } catch (error) {
      await t.rollback();
      res.status(500).json({ error: error.message });
    }
  },
};

module.exports = OrderController;
