const { Order, User, Currency, Wallet } = require("../models");
const sequelize = require("../config/database");

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
        return res
          .status(400)
          .json({
            error:
              "type, base_crc_id, quote_crc_id, price, and amount are required",
          });
      }

      if (base_crc_id === quote_crc_id) {
        await t.rollback();
        return res
          .status(400)
          .json({ error: "Base and quote currencies must be different" });
      }

      // Determine which wallet to lock funds from
      const lockCrcId = type === "sell" ? base_crc_id : quote_crc_id;
      const lockAmount =
        type === "sell"
          ? parseFloat(amount)
          : parseFloat(price) * parseFloat(amount);

      const wallet = await Wallet.findOne({
        where: { owner_id: user_id, crc_id: lockCrcId },
        transaction: t,
        lock: true,
      });

      if (!wallet || parseFloat(wallet.balance) < lockAmount) {
        await t.rollback();
        return res.status(400).json({ error: "Insufficient balance" });
      }

      // Lock funds
      wallet.balance = parseFloat(wallet.balance) - lockAmount;
      wallet.balance_lck = parseFloat(wallet.balance_lck) + lockAmount;
      await wallet.save({ transaction: t });

      // Create the order
      const order = await Order.create(
        {
          user_id,
          type,
          base_crc_id,
          quote_crc_id,
          price,
          amount,
          remain_amount: amount,
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
};

module.exports = OrderController;
