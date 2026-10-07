const BigNumber = require("bignumber.js");

// Configure BigNumber precision to 18 decimal places for crypto/financial calculations
BigNumber.config({
  DECIMAL_PLACES: 18,
  EXPONENTIAL_AT: [-19, 30],
  ROUNDING_MODE: BigNumber.ROUND_DOWN,
});

const DecimalUtil = {
  /**
   * Convert value to BigNumber instance
   */
  toBN(value) {
    return new BigNumber(value || 0);
  },

  /**
   * Add two numbers precisely: a + b
   */
  plus(a, b) {
    return new BigNumber(a || 0).plus(b || 0).toFixed();
  },

  /**
   * Subtract two numbers precisely: a - b
   */
  minus(a, b) {
    return new BigNumber(a || 0).minus(b || 0).toFixed();
  },

  /**
   * Multiply two numbers precisely: a * b
   */
  times(a, b) {
    return new BigNumber(a || 0).times(b || 0).toFixed();
  },

  /**
   * Divide two numbers precisely: a / b
   */
  div(a, b) {
    return new BigNumber(a || 0).dividedBy(b).toFixed();
  },

  /**
   * Check if a < b
   */
  isLessThan(a, b) {
    return new BigNumber(a || 0).isLessThan(b || 0);
  },

  /**
   * Check if a <= b
   */
  isLessThanOrEqualTo(a, b) {
    return new BigNumber(a || 0).isLessThanOrEqualTo(b || 0);
  },

  /**
   * Check if a > b
   */
  isGreaterThan(a, b) {
    return new BigNumber(a || 0).isGreaterThan(b || 0);
  },

  /**
   * Check if a >= b
   */
  isGreaterThanOrEqualTo(a, b) {
    return new BigNumber(a || 0).isGreaterThanOrEqualTo(b || 0);
  },

  /**
   * Check if a === 0
   */
  isZero(a) {
    return new BigNumber(a || 0).isZero();
  },

  /**
   * Check if value is a valid positive number (> 0)
   */
  isPositive(a) {
    const bn = new BigNumber(a);
    return !bn.isNaN() && bn.isGreaterThan(0);
  },

  /**
   * Return the minimum of two values
   */
  min(a, b) {
    return BigNumber.min(new BigNumber(a || 0), new BigNumber(b || 0)).toFixed();
  },

  /**
   * Format decimal with specific decimal places
   */
  format(value, decimals = 8) {
    return new BigNumber(value || 0).toFixed(decimals);
  },
};

module.exports = DecimalUtil;
