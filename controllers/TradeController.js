const { Trade, Order, User, Currency, Wallet } = require("../models");
const sequelize = require("../config/database");
const { Op } = require("sequelize");
const DecimalUtil = require("../utils/decimal");

const TradeController = {
  // Accept an order and complete the trade in one step.
  // Validates balances, locks and transfers funds atomically.
  executeTrade: async (req, res) => {
    const t = await sequelize.transaction();
    try {
      const acceptingUserId = req.user.id;
      const { amount } = req.body || {};

      // Lock the order row to prevent concurrent double execution (over-fill race condition)
      const order = await Order.findByPk(req.params.id, {
        transaction: t,
        lock: true,
      });

      if (!order) {
        await t.rollback();
        return res.status(404).json({ error: "Order not found" });
      }

      if (order.status !== "open" && order.status !== "partial") {
        await t.rollback();
        return res
          .status(400)
          .json({ error: "Order is not available for trading" });
      }

      if (order.user_id === acceptingUserId) {
        await t.rollback();
        return res
          .status(400)
          .json({ error: "Cannot trade with your own order" });
      }

      if (DecimalUtil.isLessThanOrEqualTo(order.remain_amount, 0)) {
        await t.rollback();
        return res
          .status(400)
          .json({ error: "Order is already completely filled" });
      }

      // Validate amount if provided
      if (amount !== undefined && amount !== null) {
        if (!DecimalUtil.isPositive(amount)) {
          await t.rollback();
          return res
            .status(400)
            .json({ error: "amount must be a positive number" });
        }
      }

      const tradeAmount = amount
        ? DecimalUtil.min(amount, order.remain_amount)
        : String(order.remain_amount);

      if (!DecimalUtil.isPositive(tradeAmount)) {
        await t.rollback();
        return res.status(400).json({ error: "Invalid trade amount" });
      }

      const quoteAmount = DecimalUtil.times(tradeAmount, order.price);

      // Determine buyer and seller based on order type
      const buyerId = order.type === "sell" ? acceptingUserId : order.user_id;
      const sellerId = order.type === "sell" ? order.user_id : acceptingUserId;

      // Validate and debit the accepting user's balance
      if (order.type === "sell") {
        // Accepting user is the buyer
        const buyerQuoteWallet = await Wallet.findOne({
          where: { owner_id: acceptingUserId, crc_id: order.quote_crc_id },
          transaction: t,
          lock: true,
        });
        if (
          !buyerQuoteWallet ||
          DecimalUtil.isLessThan(buyerQuoteWallet.balance, quoteAmount)
        ) {
          await t.rollback();
          return res.status(400).json({ error: "Insufficient balance to buy" });
        }
        buyerQuoteWallet.balance = DecimalUtil.minus(
          buyerQuoteWallet.balance,
          quoteAmount,
        );
        await buyerQuoteWallet.save({ transaction: t });
      } else {
        // Accepting user is the seller
        const sellerBaseWallet = await Wallet.findOne({
          where: { owner_id: acceptingUserId, crc_id: order.base_crc_id },
          transaction: t,
          lock: true,
        });
        if (
          !sellerBaseWallet ||
          DecimalUtil.isLessThan(sellerBaseWallet.balance, tradeAmount)
        ) {
          await t.rollback();
          return res
            .status(400)
            .json({ error: "Insufficient balance to sell" });
        }
        sellerBaseWallet.balance = DecimalUtil.minus(
          sellerBaseWallet.balance,
          tradeAmount,
        );
        await sellerBaseWallet.save({ transaction: t });
      }

      // Release order creator's locked funds and transfer to counterpart
      // Transfer base currency : seller → buyer
      const sellerBaseLockWallet = await Wallet.findOne({
        where: { owner_id: sellerId, crc_id: order.base_crc_id },
        transaction: t,
        lock: true,
      });

      if (sellerId === order.user_id) {
        // Order creator is the seller: debit locked balance
        if (
          !sellerBaseLockWallet ||
          DecimalUtil.isLessThan(sellerBaseLockWallet.balance_lck, tradeAmount)
        ) {
          await t.rollback();
          return res
            .status(400)
            .json({ error: "Insufficient locked funds in seller wallet" });
        }
        sellerBaseLockWallet.balance_lck = DecimalUtil.minus(
          sellerBaseLockWallet.balance_lck,
          tradeAmount,
        );
        await sellerBaseLockWallet.save({ transaction: t });
      }

      const buyerBaseWallet = await Wallet.findOne({
        where: { owner_id: buyerId, crc_id: order.base_crc_id },
        transaction: t,
        lock: true,
      });
      buyerBaseWallet.balance = DecimalUtil.plus(
        buyerBaseWallet.balance,
        tradeAmount,
      );
      await buyerBaseWallet.save({ transaction: t });

      // Transfer quote currency : buyer → seller
      if (buyerId === order.user_id) {
        // Order creator is the buyer: debit locked quote balance
        const buyerQuoteLockWallet = await Wallet.findOne({
          where: { owner_id: buyerId, crc_id: order.quote_crc_id },
          transaction: t,
          lock: true,
        });
        if (
          !buyerQuoteLockWallet ||
          DecimalUtil.isLessThan(buyerQuoteLockWallet.balance_lck, quoteAmount)
        ) {
          await t.rollback();
          return res
            .status(400)
            .json({ error: "Insufficient locked funds in buyer wallet" });
        }
        buyerQuoteLockWallet.balance_lck = DecimalUtil.minus(
          buyerQuoteLockWallet.balance_lck,
          quoteAmount,
        );
        await buyerQuoteLockWallet.save({ transaction: t });
      }

      const sellerQuoteWallet = await Wallet.findOne({
        where: { owner_id: sellerId, crc_id: order.quote_crc_id },
        transaction: t,
        lock: true,
      });
      sellerQuoteWallet.balance = DecimalUtil.plus(
        sellerQuoteWallet.balance,
        quoteAmount,
      );
      await sellerQuoteWallet.save({ transaction: t });

      // Create trade record
      const trade = await Trade.create(
        {
          order_id: order.id,
          buyer_id: buyerId,
          seller_id: sellerId,
          base_crc_id: order.base_crc_id,
          quote_crc_id: order.quote_crc_id,
          price: String(order.price),
          base_amount: tradeAmount,
          quote_amount: quoteAmount,
          status: "completed",
        },
        { transaction: t },
      );

      // Update order remaining amount atomically
      const newRemainAmount = DecimalUtil.minus(
        order.remain_amount,
        tradeAmount,
      );
      order.remain_amount = newRemainAmount;
      order.status = DecimalUtil.isZero(newRemainAmount) ? "completed" : "partial";
      await order.save({ transaction: t });

      await t.commit();
      res.status(201).json({ message: "Trade completed successfully", trade });
    } catch (error) {
      await t.rollback();
      res.status(500).json({ error: error.message });
    }
  },

  // Get all trades for the authenticated user (as buyer or seller).
  getUserTrades: async (req, res) => {
    try {
      const userId = req.user.id;

      const trades = await Trade.findAll({
        where: {
          [Op.or]: [{ buyer_id: userId }, { seller_id: userId }],
        },
        include: [
          { model: Order, as: "order" },
          { model: User, as: "buyer", attributes: ["id", "username"] },
          { model: User, as: "seller", attributes: ["id", "username"] },
          { model: Currency, as: "baseCurrency", attributes: ["id", "code"] },
          { model: Currency, as: "quoteCurrency", attributes: ["id", "code"] },
        ],
        order: [["cdate", "DESC"]],
      });

      res.json(trades);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
};

module.exports = TradeController;
