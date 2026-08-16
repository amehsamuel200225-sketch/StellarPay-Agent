const { createKeypair, fundTestnetAccount, SpendingLimitChecker } = require('./packages/stellar-core/dist/index');

async function test() {
  console.log('Testing wallet generation...');
  const keys = createKeypair();
  console.log('Public Key:', keys.publicKey);
  console.log('Secret Key:', keys.secretKey.substring(0, 5) + '...');

  console.log('Testing Friendbot funding...');
  try {
    await fundTestnetAccount(keys.publicKey);
    console.log('Successfully funded!');
  } catch (err) {
    console.error('Friendbot failed:', err.message);
  }

  console.log('Testing Spending Limit Checker...');
  const checker = new SpendingLimitChecker({
    dailyLimit: 20,
    perTxLimit: 5,
    dailySpent: 12,
    lastResetAt: new Date().toISOString(),
    isRevoked: false,
  });

  console.log('Check $3 payment (should be allowed):', checker.check(3));
  console.log('Check $6 payment (should exceed per-tx limit):', checker.check(6));
  console.log('Check $9 payment (should exceed daily remaining limit):', checker.check(9));
}

test();
