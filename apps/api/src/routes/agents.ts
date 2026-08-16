import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { getDb } from '../db/database';
import { encryptSecret, decryptSecret } from '../lib/crypto';
import {
  createKeypair,
  fundTestnetAccount,
  establishUSDCTrustline,
  getAccountBalances,
  validateLimitConfig,
} from '@stellarpay/stellar-core';

const router = Router();

// All agent routes require auth
router.use(authMiddleware);

// POST /agents — Create a new agent wallet
router.post('/', async (req: AuthRequest, res: Response) => {
  const { name, description, dailyLimit = 20, perTxLimit = 5, asset = 'USDC' } = req.body;

  if (!name) {
    res.status(400).json({ error: 'Agent name is required' });
    return;
  }

  const limitError = validateLimitConfig(Number(dailyLimit), Number(perTxLimit));
  if (limitError) {
    res.status(400).json({ error: limitError });
    return;
  }

  if (!['USDC', 'XLM'].includes(asset)) {
    res.status(400).json({ error: 'Asset must be USDC or XLM' });
    return;
  }

  try {
    // 1. Generate keypair
    const keypair = createKeypair();

    // 2. Fund via Friendbot (testnet)
    await fundTestnetAccount(keypair.publicKey);

    // 3. Establish USDC trustline if needed
    if (asset === 'USDC') {
      await establishUSDCTrustline(keypair.secretKey);
    }

    // 4. Encrypt secret key
    const encrypted = encryptSecret(keypair.secretKey);

    // 5. Save to DB
    const agentId = uuidv4();
    const db = getDb();

    db.prepare(`
      INSERT INTO agents (
        id, user_id, name, description, public_key,
        encrypted_secret, encryption_iv, encryption_tag,
        asset, daily_limit, per_tx_limit, last_reset_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      agentId,
      req.user!.id,
      name.trim(),
      description?.trim() || null,
      keypair.publicKey,
      encrypted.encrypted,
      encrypted.iv,
      encrypted.tag,
      asset,
      Number(dailyLimit),
      Number(perTxLimit)
    );

    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId) as Agent;

    res.status(201).json({
      agent: sanitizeAgent(agent),
      publicKey: keypair.publicKey,
    });
  } catch (err) {
    console.error('Agent creation error:', err);
    res.status(500).json({ error: 'Failed to create agent wallet. Please try again.' });
  }
});

// GET /agents — List user's agents
router.get('/', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const agents = db.prepare('SELECT * FROM agents WHERE user_id = ? ORDER BY created_at DESC').all(
    req.user!.id
  ) as Agent[];

  res.json({ agents: agents.map(sanitizeAgent) });
});

// GET /agents/:id — Agent details + live balance
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const agent = db.prepare('SELECT * FROM agents WHERE id = ? AND user_id = ?').get(
    req.params.id,
    req.user!.id
  ) as Agent | undefined;

  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  try {
    const balances = await getAccountBalances(agent.public_key);
    res.json({ agent: sanitizeAgent(agent), balances });
  } catch {
    res.json({ agent: sanitizeAgent(agent), balances: { xlm: '0', usdc: '0' } });
  }
});

// PUT /agents/:id/limits — Update spending limits
router.put('/:id/limits', (req: AuthRequest, res: Response) => {
  const { dailyLimit, perTxLimit } = req.body;

  if (dailyLimit === undefined && perTxLimit === undefined) {
    res.status(400).json({ error: 'At least one limit value required' });
    return;
  }

  const db = getDb();
  const agent = db.prepare('SELECT * FROM agents WHERE id = ? AND user_id = ?').get(
    req.params.id,
    req.user!.id
  ) as Agent | undefined;

  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  const newDailyLimit = dailyLimit !== undefined ? Number(dailyLimit) : agent.daily_limit;
  const newPerTxLimit = perTxLimit !== undefined ? Number(perTxLimit) : agent.per_tx_limit;

  const limitError = validateLimitConfig(newDailyLimit, newPerTxLimit);
  if (limitError) {
    res.status(400).json({ error: limitError });
    return;
  }

  db.prepare('UPDATE agents SET daily_limit = ?, per_tx_limit = ? WHERE id = ?').run(
    newDailyLimit,
    newPerTxLimit,
    agent.id
  );

  const updated = db.prepare('SELECT * FROM agents WHERE id = ?').get(agent.id) as Agent;
  res.json({ agent: sanitizeAgent(updated) });
});

// PUT /agents/:id/revoke — Freeze/revoke an agent
router.put('/:id/revoke', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const agent = db.prepare('SELECT * FROM agents WHERE id = ? AND user_id = ?').get(
    req.params.id,
    req.user!.id
  ) as Agent | undefined;

  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  db.prepare('UPDATE agents SET is_revoked = 1 WHERE id = ?').run(agent.id);

  res.json({
    message: 'Agent has been revoked. All future payments will be blocked.',
    agentId: agent.id,
  });
});

// PUT /agents/:id/restore — Restore a revoked agent
router.put('/:id/restore', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const agent = db.prepare('SELECT * FROM agents WHERE id = ? AND user_id = ?').get(
    req.params.id,
    req.user!.id
  ) as Agent | undefined;

  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  db.prepare('UPDATE agents SET is_revoked = 0 WHERE id = ?').run(agent.id);
  res.json({ message: 'Agent restored successfully.' });
});

// Internal type
interface Agent {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  public_key: string;
  encrypted_secret: string;
  encryption_iv: string;
  encryption_tag: string;
  asset: string;
  daily_limit: number;
  per_tx_limit: number;
  daily_spent: number;
  last_reset_at: string;
  is_revoked: number;
  created_at: string;
}

function sanitizeAgent(agent: Agent) {
  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    publicKey: agent.public_key,
    asset: agent.asset,
    dailyLimit: agent.daily_limit,
    perTxLimit: agent.per_tx_limit,
    dailySpent: agent.daily_spent,
    lastResetAt: agent.last_reset_at,
    isRevoked: Boolean(agent.is_revoked),
    createdAt: agent.created_at,
  };
}

export { sanitizeAgent };
export type { Agent };
export default router;
