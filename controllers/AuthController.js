const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { User, Wallet, Currency } = require("../models");

const AuthController = {
  register: async (req, res) => {
    try {
      const { username, email, password } = req.body;

      if (!username || !email || !password) {
        return res
          .status(400)
          .json({ error: "username, email, and password are required" });
      }

      if (username.length < 3) {
        return res
          .status(400)
          .json({ error: "Username must be at least 3 characters" });
      }

      if (password.length < 6) {
        return res
          .status(400)
          .json({ error: "Password must be at least 6 characters" });
      }

      // Check if user already exists
      const existing = await User.findOne({ where: { email } });

      if (existing) {
        return res.status(409).json({ error: "Email is already registered" });
      }

      const pass_hash = await bcrypt.hash(password, 10);
      const user = await User.create({ username, email, pass_hash });

      // Auto-create wallets for all active currencies
      const currencies = await Currency.findAll({ where: { is_active: true } });
      const walletData = currencies.map((c) => ({
        owner_id: user.id,
        crc_id: c.id,
        balance: 0,
        balance_lck: 0,
      }));
      await Wallet.bulkCreate(walletData);

      res.status(201).json({
        message: "Registration successful",
        user: { id: user.id, username: user.username, email: user.email },
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Login with email and password
  login: async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res
          .status(400)
          .json({ error: "email and password are required" });
      }

      const user = await User.findOne({ where: { email } });

      if (!user) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Verify password with bcrypt
      const isMatch = await bcrypt.compare(password, user.pass_hash);
      if (!isMatch) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const token = jwt.sign(
        { id: user.id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: "2h" },
      );

      res.json({ message: "Login successful", token });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
};

module.exports = AuthController;
