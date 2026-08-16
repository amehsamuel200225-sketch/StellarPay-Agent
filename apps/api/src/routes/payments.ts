import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { getDb } from '../db/database';
import { decryptSecret } from '../lib/crypto';
import { SpendingLimitChecker, sendPayment, isValidPublicKey } from '@stellarpay/stellar-core';
import { Agent } from './agents';

const router = Router();

router.use(authMiddleware);

// POST /payments — Execute a payment from an agent wallet
router.post('/', async (req: AuthRequest, res: Response) => {
  const { agentId, destination, amount, memo } = req.body;

  if (!agentId || !destination || !amount) {
    res.status(400).json({ error: 'agentId, destination, and amount are required' });
    return;
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    res.status(400).json({ error: 'Amount must be a positive number' });
    return;
  }

  if (!isValidPublicKey(destination)) {
    res.status(400).json({ error: 'Invalid destination Stellar public key' });
    return;
  }

  const db = getDb();

  // Load agent — verify ownership
  const agent = db.prepare('SELECT * FROM agents WHERE id = ? AND user_id = ?').get(
    agentId,
    req.user!.id
  ) as Agent | undefined;

  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  // Check spending limits
  const checker = new SpendingLimitChecker({
    dailyLimit: agent.daily_limit,
    perTxLimit: agent.per_tx_limit,
    dailySpent: agent.daily_spent,
    lastResetAt: agent.last_reset_at,
    isRevoked: Boolean(agent.is_revoked),
  });

  // Reset daily counter if new day
  if (checker.shouldResetDaily()) {
    db.prepare("UPDATE agents SET daily_spent = 0, last_reset_at = datetime('now') WHERE id = ?").run(agent.id);
    agent.daily_spent = 0;
    agent.last_reset_at = new Date().toISOString();
  }

  const limitCheck = checker.check(parsedAmount);

  const txId = uuidv4();

  if (!limitCheck.allowed) {
    // Record rejected transaction
    db.prepare(`
      INSERT INTO transactions (id, agent_id, user_id, amount, asset, destination, memo, status, rejection_reason)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'rejected', ?)
    `).run(txId, agentId, req.user!.id, parsedAmount, agent.asset, destination, memo || null, limitCheck.reason);

    res.status(403).json({
      error: 'Payment rejected by spending limit policy',
      reason: limitCheck.reason,
      remainingToday: limitCheck.remainingToday,
    });
    return;
  }

  // Decrypt agent secret
  let secretKey: string;
  try {
    secretKey = decryptSecret({
      encrypted: agent.encrypted_secret,
      iv: agent.encryption_iv,
      tag: agent.encryption_tag,
    });
  } catch {
    res.status(500).json({ error: 'Failed to decrypt agent credentials' });
    return;
  }

  try {
    // Execute payment on Stellar
    const result = await sendPayment({
      fromSecret: secretKey,
      toPublicKey: destination,
      amount: parsedAmount.toFixed(7),
      asset: agent.asset as 'USDC' | 'XLM',
      memo: memo,
    });

    // Record successful transaction
    db.prepare(`
      INSERT INTO transactions (id, agent_id, user_id, tx_hash, amount, asset, destination, memo, status, explorer_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'success', ?)
    `).run(
      txId, agentId, req.user!.id, result.txHash,
      parsedAmount, agent.asset, destination, memo || null, result.explorerUrl
    );

    // Update daily spent
    db.prepare('UPDATE agents SET daily_spent = daily_spent + ? WHERE id = ?').run(parsedAmount, agentId);

    res.status(201).json({
      transaction: {
        id: txId,
        txHash: result.txHash,
        explorerUrl: result.explorerUrl,
        amount: parsedAmount,
        asset: agent.asset,
        destination,
        memo,
        status: 'success',
        createdAt: new Date().toISOString(),
      },
      remainingToday: limitCheck.remainingToday,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Payment execution error:', err);

    // Record failed transaction
    db.prepare(`
      INSERT INTO transactions (id, agent_id, user_id, amount, asset, destination, memo, status, rejection_reason)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'failed', ?)
    `).run(txId, agentId, req.user!.id, parsedAmount, agent.asset, destination, memo || null, errorMessage);

    res.status(502).json({
      error: 'Payment failed on Stellar network',
      details: errorMessage,
    });
  }
});

// GET /payments — All transactions for user
router.get('/', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const offset = parseInt(req.query.offset as string) || 0;

  const transactions = db.prepare(`
    SELECT t.*, a.name as agent_name, a.public_key as agent_public_key
    FROM transactions t
    JOIN agents a ON t.agent_id = a.id
    WHERE t.user_id = ?
    ORDER BY t.created_at DESC
    LIMIT ? OFFSET ?
  `).all(req.user!.id, limit, offset);

  const total = (db.prepare('SELECT COUNT(*) as count FROM transactions WHERE user_id = ?')
    .get(req.user!.id) as { count: number }).count;

  res.json({ transactions, total, limit, offset });
});

// GET /payments/agent/:agentId — Transactions for one agent
router.get('/agent/:agentId', (req: AuthRequest, res: Response) => {
  const db = getDb();

  // Verify agent ownership
  const agent = db.prepare('SELECT id FROM agents WHERE id = ? AND user_id = ?').get(
    req.params.agentId,
    req.user!.id
  );

  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const transactions = db.prepare(`
    SELECT * FROM transactions
    WHERE agent_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(req.params.agentId, limit);

  res.json({ transactions });
});

export default router;
