const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';

const TEST_WALLET = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
const TEST_WALLETS_BATCH = [
  '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  '0x1234567890123456789012345678901234567890',
];

async function testHealthCheck() {
  console.log('\n🔍 Testing Health Check...');
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    const data = await response.json();
    console.log('✅ Health Check Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('❌ Health Check Failed:', error.message);
  }
}

async function testVerifyMining(walletAddress) {
  console.log(`\n🔍 Testing Mining Verification for ${walletAddress}...`);
  try {
    const response = await fetch(`${API_BASE_URL}/api/verify/${walletAddress}`);
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ User has mined!');
      console.log(`   Score: ${data.data.score}`);
      console.log(`   Total Mining Txs: ${data.data.totalMiningTxs}`);
      console.log(`   Full Data:`, JSON.stringify(data.data, null, 2));
    } else {
      console.log('❌ User has not mined yet');
      console.log('   Response:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('❌ Verification Failed:', error.message);
  }
}

async function testMinimumTransactions(walletAddress, minTxs) {
  console.log(`\n🔍 Testing Minimum Transactions (${minTxs}) for ${walletAddress}...`);
  try {
    const response = await fetch(`${API_BASE_URL}/api/verify/${walletAddress}/min-txs/${minTxs}`);
    const data = await response.json();
    
    if (data.success) {
      console.log(`✅ Meets requirement of ${minTxs} transactions`);
      console.log(`   Total Txs: ${data.totalMiningTxs}`);
      console.log(`   Score: ${data.data.score}`);
    } else {
      console.log(`❌ Does not meet requirement of ${minTxs} transactions`);
      console.log(`   Total Txs: ${data.totalMiningTxs || 0}`);
    }
  } catch (error) {
    console.error('❌ Test Failed:', error.message);
  }
}

async function testMinimumScore(walletAddress, minScore) {
  console.log(`\n🔍 Testing Minimum Score (${minScore}) for ${walletAddress}...`);
  try {
    const response = await fetch(`${API_BASE_URL}/api/verify/${walletAddress}/min-score/${minScore}`);
    const data = await response.json();
    
    if (data.success) {
      console.log(`✅ Meets score requirement of ${minScore}`);
      console.log(`   User Score: ${data.score}`);
      console.log(`   Total Txs: ${data.data.totalMiningTxs}`);
    } else {
      console.log(`❌ Does not meet score requirement of ${minScore}`);
      console.log(`   User Score: ${data.score || 0}`);
    }
  } catch (error) {
    console.error('❌ Test Failed:', error.message);
  }
}

async function testBatchVerification(walletAddresses) {
  console.log(`\n🔍 Testing Batch Verification for ${walletAddresses.length} addresses...`);
  try {
    const response = await fetch(`${API_BASE_URL}/api/verify/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ walletAddresses }),
    });
    const data = await response.json();
    
    console.log('✅ Batch Verification Results:');
    data.results.forEach((result, index) => {
      console.log(`\n   Address ${index + 1}: ${result.walletAddress}`);
      if (result.success) {
        console.log(`   ✅ Has Mined - Score: ${result.score}, Txs: ${result.totalMiningTxs}`);
      } else {
        console.log(`   ❌ Has Not Mined`);
      }
    });
  } catch (error) {
    console.error('❌ Batch Test Failed:', error.message);
  }
}

async function runAllTests() {
  console.log('🚀 Starting API Tests...');
  console.log(`📡 API Base URL: ${API_BASE_URL}`);
  
  await testHealthCheck();
  await testVerifyMining(TEST_WALLET);
  await testMinimumTransactions(TEST_WALLET, 5);
  await testMinimumScore(TEST_WALLET, 1000000);
  await testBatchVerification(TEST_WALLETS_BATCH);
  
  console.log('\n✨ All tests completed!\n');
}

if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testHealthCheck,
  testVerifyMining,
  testMinimumTransactions,
  testMinimumScore,
  testBatchVerification,
};
