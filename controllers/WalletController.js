const { Wallet, Currency, Transfer, User } = require("../models");
const sequelize = require("../config/database");
const { Op } = require("sequelize");
const DecimalUtil = require("../utils/decimal");

const WalletController = {
  // Get all wallets for the authenticated user with currency details.
  getMyWallets: async (req, res) => {
    try {
      const wallets = await Wallet.findAll({
        where: { owner_id: req.user.id },
        include: [
          {
            model: Currency,
            as: "currency",
            attributes: ["id", "code", "type"],
          },
        ],
      });

      res.json(wallets);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Transfer coins internally or externally
  transfer: async (req, res) => {
    const t = await sequelize.transaction();
    try {
      const { to_username, recipient_address, crc_id, amount } = req.body;
      const sender_id = req.user.id;

      if (!crc_id || !DecimalUtil.isPositive(amount)) {
        await t.rollback();
        return res.status(400).json({ error: "Invalid currency or amount" });
      }

      if (!to_username && !recipient_address) {
        await t.rollback();
        return res.status(400).json({
          error: "Must provide either to_username or recipient_address",
        });
      }

      const currency = await Currency.findByPk(crc_id);
      if (!currency) {
        await t.rollback();
        return res.status(404).json({ error: "Currency not found" });
      }

      // Check minimum withdrawal for external transfers
      if (!to_username && recipient_address) {
        if (
          DecimalUtil.isPositive(currency.min_withdraw) &&
          DecimalUtil.isLessThan(amount, currency.min_withdraw)
        ) {
          await t.rollback();
          return res.status(400).json({
            error: `Minimum withdrawal for ${currency.code} is ${currency.min_withdraw}`,
          });
        }
      }

      // Check sender balance
      const senderWallet = await Wallet.findOne({
        where: { owner_id: sender_id, crc_id },
        transaction: t,
        lock: true,
      });

      if (
        !senderWallet ||
        DecimalUtil.isLessThan(senderWallet.balance, amount)
      ) {
        await t.rollback();
        return res.status(400).json({ error: "Insufficient balance" });
      }

      let receiver_id = null;
      let type = "external";

      // If internal transfer (by username)
      if (to_username) {
        const receiver = await User.findOne({
          where: { username: to_username },
          transaction: t,
        });
        if (!receiver) {
          await t.rollback();
          return res
            .status(404)
            .json({ error: "Recipient username not found" });
        }
        if (receiver.id === sender_id) {
          await t.rollback();
          return res
            .status(400)
            .json({ error: "Cannot transfer to yourself" });
        }

        receiver_id = receiver.id;
        type = "internal";

        // Add to receiver balance
        const receiverWallet = await Wallet.findOne({
          where: { owner_id: receiver_id, crc_id },
          transaction: t,
          lock: true,
        });

        // Auto-create wallet if recipient doesn't have one (though seed creates for all)
        if (receiverWallet) {
          receiverWallet.balance = DecimalUtil.plus(
            receiverWallet.balance,
            amount,
          );
          await receiverWallet.save({ transaction: t });
        } else {
          await Wallet.create(
            {
              owner_id: receiver_id,
              crc_id: crc_id,
              balance: String(amount),
              balance_lck: "0",
            },
            { transaction: t },
          );
        }
      }

      // Deduct from sender
      senderWallet.balance = DecimalUtil.minus(senderWallet.balance, amount);
      await senderWallet.save({ transaction: t });

      // Create transfer record
      const transferRecord = await Transfer.create(
        {
          sender_id,
          receiver_id,
          crc_id,
          amount: String(amount),
          recipient_address: type !== "internal" ? recipient_address : null,
          type,
          status: "completed",
        },
        { transaction: t },
      );

      await t.commit();
      res
        .status(201)
        .json({ message: "Transfer successful", transfer: transferRecord });
    } catch (error) {
      await t.rollback();
      res.status(500).json({ error: error.message });
    }
  },

  // Get transfer history
  getTransferHistory: async (req, res) => {
    try {
      const userId = req.user.id;

      const transfers = await Transfer.findAll({
        where: {
          [Op.or]: [{ sender_id: userId }, { receiver_id: userId }],
        },
        include: [
          { model: User, as: "sender", attributes: ["id", "username"] },
          { model: User, as: "receiver", attributes: ["id", "username"] },
          { model: Currency, as: "currency", attributes: ["id", "code"] },
        ],
        order: [["cdate", "DESC"]],
      });

      res.json(transfers);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
};

module.exports = WalletController;
