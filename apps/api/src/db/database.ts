import fs from 'fs';
import path from 'path';

// JSON database file location
const dbFile = process.env.DATABASE_PATH 
  ? path.resolve(process.env.DATABASE_PATH)
  : path.join(__dirname, '../../stellarpay_db.json');

// Core database structure
interface DatabaseState {
  users: any[];
  agents: any[];
  transactions: any[];
}

class JsonDatabase {
  private state: DatabaseState = {
    users: [],
    agents: [],
    transactions: []
  };

  constructor() {
    this.load();
  }

  private load() {
    if (fs.existsSync(dbFile)) {
      try {
        const raw = fs.readFileSync(dbFile, 'utf8');
        this.state = JSON.parse(raw);
        // Ensure all collections exist
        if (!this.state.users) this.state.users = [];
        if (!this.state.agents) this.state.agents = [];
        if (!this.state.transactions) this.state.transactions = [];
      } catch (err) {
        console.error('Error loading JSON DB, starting fresh:', err);
      }
    } else {
      this.save();
    }
  }

  private save() {
    try {
      // Ensure dir exists
      const dir = path.dirname(dbFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(dbFile, JSON.stringify(this.state, null, 2), 'utf8');
    } catch (err) {
      console.error('Error saving JSON DB:', err);
    }
  }

  // Emulate db.prepare().run() / get() / all()
  prepare(sql: string) {
    const self = this;

    // Normalise SQL spacing
    const normalized = sql.replace(/\s+/g, ' ').trim();

    return {
      run(...args: any[]) {
        self.load(); // Refresh state from file

        if (normalized.startsWith('INSERT INTO users')) {
          const [id, email, password] = args;
          self.state.users.push({
            id,
            email,
            password,
            created_at: new Date().toISOString()
          });
        } else if (normalized.startsWith('INSERT INTO agents')) {
          const [
            id, user_id, name, description, public_key,
            encrypted_secret, encryption_iv, encryption_tag,
            asset, daily_limit, per_tx_limit
          ] = args;

          self.state.agents.push({
            id,
            user_id,
            name,
            description,
            public_key,
            encrypted_secret,
            encryption_iv,
            encryption_tag,
            asset,
            daily_limit,
            per_tx_limit,
            daily_spent: 0.0,
            last_reset_at: new Date().toISOString(),
            is_revoked: 0,
            created_at: new Date().toISOString()
          });
        } else if (normalized.startsWith('INSERT INTO transactions')) {
          // INSERT INTO transactions (id, agent_id, user_id, tx_hash, amount, asset, destination, memo, status, explorer_url) or with rejection_reason
          // Let's parse args based on columns in SQL.
          // Because there are two insert queries for transactions in routes/payments.ts:
          // Query 1: (id, agent_id, user_id, amount, asset, destination, memo, status, rejection_reason)
          // Query 2: (id, agent_id, user_id, tx_hash, amount, asset, destination, memo, status, explorer_url)
          if (normalized.includes('rejection_reason')) {
            const [id, agent_id, user_id, amount, asset, destination, memo, status, rejection_reason] = args;
            self.state.transactions.push({
              id,
              agent_id,
              user_id,
              tx_hash: null,
              amount,
              asset,
              destination,
              memo,
              status,
              rejection_reason,
              explorer_url: null,
              created_at: new Date().toISOString()
            });
          } else {
            const [id, agent_id, user_id, tx_hash, amount, asset, destination, memo, status, explorer_url] = args;
            self.state.transactions.push({
              id,
              agent_id,
              user_id,
              tx_hash,
              amount,
              asset,
              destination,
              memo,
              status,
              rejection_reason: null,
              explorer_url,
              created_at: new Date().toISOString()
            });
          }
        } else if (normalized.startsWith('UPDATE agents SET daily_limit = ?, per_tx_limit = ?')) {
          const [daily_limit, per_tx_limit, id] = args;
          const agent = self.state.agents.find(a => a.id === id);
          if (agent) {
            agent.daily_limit = daily_limit;
            agent.per_tx_limit = per_tx_limit;
          }
        } else if (normalized.startsWith('UPDATE agents SET daily_spent = 0, last_reset_at = datetime')) {
          const [id] = args;
          const agent = self.state.agents.find(a => a.id === id);
          if (agent) {
            agent.daily_spent = 0;
            agent.last_reset_at = new Date().toISOString();
          }
        } else if (normalized.startsWith('UPDATE agents SET daily_spent = daily_spent + ?')) {
          const [amount, id] = args;
          const agent = self.state.agents.find(a => a.id === id);
          if (agent) {
            agent.daily_spent = (agent.daily_spent || 0) + amount;
          }
        } else if (normalized.startsWith('UPDATE agents SET is_revoked = 1')) {
          const [id] = args;
          const agent = self.state.agents.find(a => a.id === id);
          if (agent) {
            agent.is_revoked = 1;
          }
        } else if (normalized.startsWith('UPDATE agents SET is_revoked = 0')) {
          const [id] = args;
          const agent = self.state.agents.find(a => a.id === id);
          if (agent) {
            agent.is_revoked = 0;
          }
        }

        self.save();
        return { changes: 1 };
      },

      get(...args: any[]) {
        self.load();

        if (normalized.startsWith('SELECT id FROM users WHERE email = ?')) {
          const [email] = args;
          return self.state.users.find(u => u.email === email.toLowerCase().trim());
        } else if (normalized.startsWith('SELECT * FROM users WHERE email = ?')) {
          const [email] = args;
          return self.state.users.find(u => u.email === email.toLowerCase().trim());
        } else if (normalized.startsWith('SELECT * FROM agents WHERE id = ? AND user_id = ?')) {
          const [id, user_id] = args;
          return self.state.agents.find(a => a.id === id && a.user_id === user_id);
        } else if (normalized.startsWith('SELECT * FROM agents WHERE id = ?')) {
          const [id] = args;
          return self.state.agents.find(a => a.id === id);
        } else if (normalized.startsWith('SELECT COUNT(*) as count FROM transactions WHERE user_id = ?')) {
          const [user_id] = args;
          const txs = self.state.transactions.filter(t => t.user_id === user_id);
          return { count: txs.length };
        }

        return undefined;
      },

      all(...args: any[]) {
        self.load();

        if (normalized.startsWith('SELECT * FROM agents WHERE user_id = ?')) {
          const [user_id] = args;
          return self.state.agents
            .filter(a => a.user_id === user_id)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        } else if (normalized.includes('FROM transactions t JOIN agents a ON t.agent_id = a.id WHERE t.user_id = ?')) {
          // GET /payments
          const [user_id, limit, offset] = args;
          const joined = self.state.transactions
            .filter(t => t.user_id === user_id)
            .map(t => {
              const agent = self.state.agents.find(a => a.id === t.agent_id);
              return {
                ...t,
                agent_name: agent ? agent.name : 'Unknown Agent',
                agent_public_key: agent ? agent.public_key : ''
              };
            })
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

          return joined.slice(offset, offset + limit);
        } else if (normalized.startsWith('SELECT * FROM transactions WHERE agent_id = ?')) {
          const [agent_id, limit] = args;
          return self.state.transactions
            .filter(t => t.agent_id === agent_id)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, limit);
        }

        return [];
      }
    };
  }

  exec(sql: string) {
    // No-op for compatibility
  }

  pragma(p: string) {
    // No-op for compatibility
  }
}

let dbInstance: JsonDatabase;

export function getDb() {
  if (!dbInstance) {
    dbInstance = new JsonDatabase();
  }
  return dbInstance;
}

export function initializeSchema(): void {
  // DB self-initializes on startup
  console.log('✅ Lightweight JSON Database initialized at:', dbFile);
}
