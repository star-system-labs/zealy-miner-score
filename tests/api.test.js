const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { ethers } = require('ethers');

const configuredAddresses = (process.env.MINING_RIG_ADDRESSES || process.env.MINING_RIG_ADDRESS || '')
  .split(',')
  .map((address) => address.trim())
  .filter(Boolean);

const sanitizedConfiguredAddresses = configuredAddresses
  .map((address) => {
    try {
      return ethers.getAddress(address);
    } catch (error) {
      console.warn('Ignoring invalid MiningRig address in test setup:', address, error.message);
      return null;
    }
  })
  .filter(Boolean);

const TEST_ADDRESS = '0xB814aE6b2F368E8E8392B7D897044677f5f8bE2b';

const app = require('../src/index.js');

const originalContracts = app.locals.miningRigContracts;
const invalidConfiguredAddresses = app.locals.invalidMiningRigAddresses || [];
const normalizedConfiguredAddresses = (
  originalContracts && originalContracts.length
    ? originalContracts.map(({ address }) => address)
    : sanitizedConfiguredAddresses
).map((address) => address.toLowerCase());

const integrationSkipReasons = [];

if (!process.env.RPC_URL) {
  integrationSkipReasons.push('RPC_URL not configured');
}

if (!originalContracts || !originalContracts.length) {
  integrationSkipReasons.push('MiningRig contracts not initialized');
}

if (!normalizedConfiguredAddresses.length) {
  integrationSkipReasons.push('No valid MiningRig addresses available');
}

if (invalidConfiguredAddresses.length) {
  integrationSkipReasons.push(
    `Invalid MiningRig addresses ignored: ${invalidConfiguredAddresses.join(', ')}`
  );
}

const shouldSkipIntegration = integrationSkipReasons.some((reason) =>
  ['RPC_URL not configured', 'MiningRig contracts not initialized', 'No valid MiningRig addresses available'].includes(reason)
);

if (integrationSkipReasons.length) {
  console.warn('Integration test diagnostics:', integrationSkipReasons.join(' | '));
}

const canRunIntegration = !shouldSkipIntegration;

if (!canRunIntegration && integrationSkipReasons.length) {
  console.warn('Integration test will be skipped:', integrationSkipReasons.join(' | '));
}

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection during tests:', reason);
});

const mockStatePrimary = {
  scores: {
    base: 0n,
    balance: 0n,
    frequency: 0n,
    held: 0n,
    debt: 0n,
    redeemable: 0n,
    totalMiningTxs: 0n
  },
  score: 0n
};

const mockStateSecondary = {
  scores: {
    base: 0n,
    balance: 0n,
    frequency: 0n,
    held: 0n,
    debt: 0n,
    redeemable: 0n,
    totalMiningTxs: 0n
  },
  score: 0n
};

function createMockContracts() {
  return [
    {
      address: '0xRigOne',
      contract: {
        scores: async () => mockStatePrimary.scores,
        score: async () => mockStatePrimary.score
      }
    },
    {
      address: '0xRigTwo',
      contract: {
        scores: async () => mockStateSecondary.scores,
        score: async () => mockStateSecondary.score
      }
    }
  ];
}

function loadMockContracts() {
  app.locals.miningRigContracts = createMockContracts();
}

function restoreOriginalContracts() {
  if (originalContracts) {
    app.locals.miningRigContracts = originalContracts;
  } else {
    delete app.locals.miningRigContracts;
  }
}

function resetMockState() {
  mockStatePrimary.scores = {
    base: 0n,
    balance: 0n,
    frequency: 0n,
    held: 0n,
    debt: 0n,
    redeemable: 0n,
    totalMiningTxs: 0n
  };
  mockStatePrimary.score = 0n;

  mockStateSecondary.scores = {
    base: 0n,
    balance: 0n,
    frequency: 0n,
    held: 0n,
    debt: 0n,
    redeemable: 0n,
    totalMiningTxs: 0n
  };
  mockStateSecondary.score = 0n;
}

function serializeState(state) {
  return {
    scores: Object.fromEntries(
      Object.entries(state.scores).map(([key, value]) => [key, value.toString()])
    ),
    score: state.score.toString()
  };
}

async function withMockContracts(fn) {
  loadMockContracts();
  resetMockState();
  try {
    await fn();
  } finally {
    resetMockState();
    restoreOriginalContracts();
  }
}

restoreOriginalContracts();

test('MiningRig API verification', async (suite) => {
  await suite.test('GET /health returns ok response', async () => {
    restoreOriginalContracts();
    const response = await request(app).get('/health');

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.status, 'ok');
    assert.ok('contract' in response.body);
  });

  await suite.test(
    'Integration: verifies configured MiningRig contracts',
    { skip: !canRunIntegration, timeout: 15000 },
    async () => {
      restoreOriginalContracts();
      const response = await request(app).get(`/api/verify/${TEST_ADDRESS}`);

      console.log('Integration test response:', JSON.stringify(response.body, null, 2));

      assert.equal(response.statusCode, 200);
      assert.ok(typeof response.body.success === 'boolean');
      assert.ok(typeof response.body.hasMined === 'boolean');

      if (response.body.hasMined) {
        console.log('✓ Wallet has mined - verifying mining data');
        assert.equal(response.body.success, true);
        assert.ok(response.body.contractAddress);
        
        if (normalizedConfiguredAddresses.length) {
          assert.ok(
            normalizedConfiguredAddresses.includes(response.body.contractAddress.toLowerCase()),
            `Contract ${response.body.contractAddress} should be in configured addresses`
          );
        }

        const stats = response.body.data;
        assert.equal(stats.walletAddress.toLowerCase(), TEST_ADDRESS.toLowerCase());
        assert.equal(stats.hasMined, true);

        const score = BigInt(stats.score);
        const totalMiningTxs = BigInt(stats.totalMiningTxs);

        assert(score >= 0n);
        assert(totalMiningTxs >= 0n);

        if (stats.scores) {
          const base = BigInt(stats.scores.base);
          assert(base > 0n);
        }

        console.log('Integration mining stats:', {
          contractAddress: response.body.contractAddress,
          score: stats.score,
          totalMiningTxs: stats.totalMiningTxs
        });
      } else {
        console.log('✓ Wallet has not mined - contract connectivity verified');
        assert.equal(response.body.success, false);
        assert.equal(response.body.data.hasMined, false);
        assert.ok(response.body.message);
        console.log('Response message:', response.body.message);
      }
    }
  );

  await suite.test('Mock: primary rig provides mining data', async () => {
    await withMockContracts(async () => {
      mockStatePrimary.scores = {
        base: 1n,
        balance: 2n,
        frequency: 3n,
        held: 4n,
        debt: 5n,
        redeemable: 6n,
        totalMiningTxs: 7n
      };
      mockStatePrimary.score = 123n;

      console.log('Mock primary scenario state:', serializeState(mockStatePrimary));

      const response = await request(app).get(`/api/verify/${TEST_ADDRESS}`);

      assert.equal(response.statusCode, 200);
      assert.equal(response.body.success, true);
      assert.equal(response.body.hasMined, true);
      assert.equal(response.body.contractAddress, '0xRigOne');
      assert.ok(response.body.rigName);
      assert.equal(response.body.data.walletAddress, TEST_ADDRESS);
      assert.equal(response.body.data.hasMined, true);
      assert.ok(response.body.data.rigName);
      assert.equal(response.body.data.score, '123');
      assert.equal(response.body.data.totalMiningTxs, '7');
      assert.ok(response.body.data.scores);
      assert.equal(response.body.data.scores.base, '1');
    });
  });

  await suite.test('Mock: falls back to secondary rig when primary has no mining', async () => {
    await withMockContracts(async () => {
      mockStateSecondary.scores = {
        base: 10n,
        balance: 20n,
        frequency: 30n,
        held: 40n,
        debt: 50n,
        redeemable: 60n,
        totalMiningTxs: 70n
      };
      mockStateSecondary.score = 456n;

      console.log('Mock fallback scenario state:', {
        primary: serializeState(mockStatePrimary),
        secondary: serializeState(mockStateSecondary)
      });

      const response = await request(app).get(`/api/verify/${TEST_ADDRESS}`);

      assert.equal(response.statusCode, 200);
      assert.equal(response.body.success, true);
      assert.equal(response.body.hasMined, true);
      assert.equal(response.body.contractAddress, '0xRigTwo');
      assert.ok(response.body.rigName);
      assert.equal(response.body.data.walletAddress, TEST_ADDRESS);
      assert.equal(response.body.data.hasMined, true);
      assert.ok(response.body.data.rigName);
      assert.equal(response.body.data.score, '456');
      assert.equal(response.body.data.totalMiningTxs, '70');
      assert.ok(response.body.data.scores);
      assert.equal(response.body.data.scores.base, '10');
    });
  });
});
