import * as StellarSdk from '@stellar/stellar-sdk';

const HORIZON_URL = process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
const NETWORK_PASSPHRASE = process.env.STELLAR_NETWORK === 'mainnet'
  ? StellarSdk.Networks.PUBLIC
  : StellarSdk.Networks.TESTNET;
const FRIENDBOT_URL = 'https://friendbot.stellar.org';

// USDC on Testnet
const USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
const USDC_ASSET = new StellarSdk.Asset('USDC', USDC_ISSUER);

export interface Keypair {
  publicKey: string;
  secretKey: string;
}

export interface WalletBalance {
  xlm: string;
  usdc: string;
}

/**
 * Generate a new Stellar keypair
 */
export function createKeypair(): Keypair {
  const keypair = StellarSdk.Keypair.random();
  return {
    publicKey: keypair.publicKey(),
    secretKey: keypair.secret(),
  };
}

/**
 * Fund a testnet account via Friendbot
 */
export async function fundTestnetAccount(publicKey: string): Promise<void> {
  const response = await fetch(`${FRIENDBOT_URL}?addr=${publicKey}`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Friendbot funding failed: ${text}`);
  }
}

/**
 * Establish USDC trustline for an account
 */
export async function establishUSDCTrustline(secretKey: string): Promise<string> {
  const keypair = StellarSdk.Keypair.fromSecret(secretKey);
  const server = new StellarSdk.Horizon.Server(HORIZON_URL);

  const account = await server.loadAccount(keypair.publicKey());

  const transaction = new StellarSdk.TransactionBuilder(account, {
    fee: (await server.fetchBaseFee()).toString(),
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      StellarSdk.Operation.changeTrust({
        asset: USDC_ASSET,
        limit: '1000000', // 1M USDC max trustline
      })
    )
    .setTimeout(30)
    .build();

  transaction.sign(keypair);
  const result = await server.submitTransaction(transaction);
  return result.hash;
}

/**
 * Get XLM and USDC balance for an account
 */
export async function getAccountBalances(publicKey: string): Promise<WalletBalance> {
  const server = new StellarSdk.Horizon.Server(HORIZON_URL);

  try {
    const account = await server.loadAccount(publicKey);
    let xlm = '0';
    let usdc = '0';

    for (const balance of account.balances) {
      if (balance.asset_type === 'native') {
        xlm = parseFloat(balance.balance).toFixed(7);
      } else if (
        balance.asset_type === 'credit_alphanum4' &&
        balance.asset_code === 'USDC' &&
        balance.asset_issuer === USDC_ISSUER
      ) {
        usdc = parseFloat(balance.balance).toFixed(2);
      }
    }

    return { xlm, usdc };
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'response' in err &&
        (err as { response?: { status?: number } }).response?.status === 404) {
      return { xlm: '0', usdc: '0' };
    }
    throw err;
  }
}

/**
 * Check if account exists on Stellar
 */
export async function accountExists(publicKey: string): Promise<boolean> {
  const server = new StellarSdk.Horizon.Server(HORIZON_URL);
  try {
    await server.loadAccount(publicKey);
    return true;
  } catch {
    return false;
  }
}

export { USDC_ASSET, USDC_ISSUER, HORIZON_URL, NETWORK_PASSPHRASE };
