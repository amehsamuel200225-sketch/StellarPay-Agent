import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initializeSchema } from './db/database';
import authRouter from './routes/auth';
import agentsRouter from './routes/agents';
import paymentsRouter from './routes/payments';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/auth', authRouter);
app.use('/agents', agentsRouter);
app.use('/payments', paymentsRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize DB and start server
initializeSchema();

app.listen(PORT, () => {
  console.log(`\n🚀 StellarPay API running on http://localhost:${PORT}`);
  console.log(`📡 Network: ${process.env.STELLAR_NETWORK || 'testnet'}`);
  console.log(`💾 Database: ${process.env.DATABASE_PATH || './stellarpay.db'}\n`);
});

export default app;
