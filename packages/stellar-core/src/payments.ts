import * as StellarSdk from '@stellar/stellar-sdk';
import { HORIZON_URL, NETWORK_PASSPHRASE, USDC_ASSET, USDC_ISSUER } from './wallet';

export interface PaymentParams {
  fromSecret: string;
  toPublicKey: string;
  amount: string;
  asset: 'USDC' | 'XLM';
  memo?: string;
}

export interface PaymentResult {
  txHash: string;
  explorerUrl: string;
  fee: string;
  ledger: number;
}

export interface TransactionRecord {
  txHash: string;
  amount: string;
  asset: string;
  destination: string;
  timestamp: string;
  memo?: string;
  explorerUrl: string;
}

const TESTNET_EXPLORER = 'https://testnet.stellar.expert/explorer/testnet/tx';

/**
 * Execute a payment from an agent wallet
 */
export async function sendPayment(params: PaymentParams): Promise<PaymentResult> {
  const { fromSecret, toPublicKey, amount, asset, memo } = params;

  const keypair = StellarSdk.Keypair.fromSecret(fromSecret);
  const server = new StellarSdk.Horizon.Server(HORIZON_URL);

  // Load source account
  const account = await server.loadAccount(keypair.publicKey());
  const baseFee = await server.fetchBaseFee();

  // Determine asset
  const stellarAsset = asset === 'USDC' ? USDC_ASSET : StellarSdk.Asset.native();

  // Build transaction
  const txBuilder = new StellarSdk.TransactionBuilder(account, {
    fee: baseFee.toString(),
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  // Add memo if provided
  if (memo) {
    txBuilder.addMemo(StellarSdk.Memo.text(memo.substring(0, 28)));
  }

  txBuilder.addOperation(
    StellarSdk.Operation.payment({
      destination: toPublicKey,
      asset: stellarAsset,
      amount: amount,
    })
  );

  txBuilder.setTimeout(30);
  const transaction = txBuilder.build();

  // Sign
  transaction.sign(keypair);

  // Submit
  const result = await server.submitTransaction(transaction);

  return {
    txHash: result.hash,
    explorerUrl: `${TESTNET_EXPLORER}/${result.hash}`,
    fee: (baseFee / 10_000_000).toFixed(7),
    ledger: result.ledger,
  };
}

/**
 * Fetch recent transaction history for an account from Horizon
 */
export async function getTransactionHistory(
  publicKey: string,
  limit: number = 50
): Promise<TransactionRecord[]> {
  const server = new StellarSdk.Horizon.Server(HORIZON_URL);

  try {
    const payments = await server.payments()
      .forAccount(publicKey)
      .limit(limit)
      .order('desc')
      .call();

    const records: TransactionRecord[] = [];

    for (const record of payments.records) {
      if (record.type === 'payment') {
        const payment = record as StellarSdk.Horizon.ServerApi.PaymentOperationRecord;
        records.push({
          txHash: payment.transaction_hash,
          amount: payment.amount,
          asset: payment.asset_type === 'native' ? 'XLM' : (payment as unknown as { asset_code: string }).asset_code || 'UNKNOWN',
          destination: payment.to,
          timestamp: payment.created_at,
          explorerUrl: `${TESTNET_EXPLORER}/${payment.transaction_hash}`,
        });
      }
    }

    return records;
  } catch {
    return [];
  }
}

/**
 * Verify a Stellar public key format
 */
export function isValidPublicKey(key: string): boolean {
  try {
    StellarSdk.Keypair.fromPublicKey(key);
    return true;
  } catch {
    return false;
  }
}
