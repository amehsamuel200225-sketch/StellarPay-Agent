export interface SpendingLimitConfig {
  dailyLimit: number;
  perTxLimit: number;
  dailySpent: number;
  lastResetAt: string; // ISO date string
  isRevoked: boolean;
}

export interface LimitCheckResult {
  allowed: boolean;
  reason?: string;
  remainingToday: number;
}

/**
 * Checks if a payment is within the agent's configured spending limits.
 * Handles daily reset logic automatically.
 */
export class SpendingLimitChecker {
  private config: SpendingLimitConfig;

  constructor(config: SpendingLimitConfig) {
    this.config = config;
  }

  /**
   * Check if payment amount is allowed given current limits and usage.
   * Returns whether it's allowed and how much remains today.
   */
  check(amount: number): LimitCheckResult {
    if (this.config.isRevoked) {
      return {
        allowed: false,
        reason: 'Agent has been revoked by the user.',
        remainingToday: 0,
      };
    }

    if (amount <= 0) {
      return {
        allowed: false,
        reason: 'Payment amount must be greater than zero.',
        remainingToday: this.getRemainingToday(),
      };
    }

    if (amount > this.config.perTxLimit) {
      return {
        allowed: false,
        reason: `Amount ${amount} exceeds per-transaction limit of ${this.config.perTxLimit}.`,
        remainingToday: this.getRemainingToday(),
      };
    }

    const effectiveSpent = this.getEffectiveDailySpent();
    const remaining = this.config.dailyLimit - effectiveSpent;

    if (amount > remaining) {
      return {
        allowed: false,
        reason: `Amount ${amount} would exceed daily limit. Remaining today: ${remaining.toFixed(2)}.`,
        remainingToday: remaining,
      };
    }

    return {
      allowed: true,
      remainingToday: remaining - amount,
    };
  }

  /**
   * Returns the effective daily spent amount, resetting to 0 if the day has changed.
   */
  getEffectiveDailySpent(): number {
    if (this.shouldResetDaily()) {
      return 0;
    }
    return this.config.dailySpent;
  }

  /**
   * Returns how much can still be spent today.
   */
  getRemainingToday(): number {
    const spent = this.getEffectiveDailySpent();
    return Math.max(0, this.config.dailyLimit - spent);
  }

  /**
   * Returns true if the daily spending counter should be reset (new UTC day).
   */
  shouldResetDaily(): boolean {
    const lastReset = new Date(this.config.lastResetAt);
    const now = new Date();

    return (
      lastReset.getUTCFullYear() !== now.getUTCFullYear() ||
      lastReset.getUTCMonth() !== now.getUTCMonth() ||
      lastReset.getUTCDate() !== now.getUTCDate()
    );
  }

  /**
   * Returns the percentage of daily limit consumed (0–100).
   */
  getDailyUsagePercent(): number {
    const spent = this.getEffectiveDailySpent();
    if (this.config.dailyLimit === 0) return 0;
    return Math.min(100, (spent / this.config.dailyLimit) * 100);
  }
}

/**
 * Quick utility to validate limit configuration values.
 */
export function validateLimitConfig(dailyLimit: number, perTxLimit: number): string | null {
  if (dailyLimit <= 0) return 'Daily limit must be greater than 0.';
  if (perTxLimit <= 0) return 'Per-transaction limit must be greater than 0.';
  if (perTxLimit > dailyLimit) return 'Per-transaction limit cannot exceed daily limit.';
  if (dailyLimit > 10000) return 'Daily limit cannot exceed 10,000 (testnet safety cap).';
  return null;
}
