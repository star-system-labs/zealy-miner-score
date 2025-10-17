const express = require('express');
const { ethers } = require('ethers');
require('dotenv').config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const RPC_URL = process.env.RPC_URL;
const SIMPLE_MODE = process.env.SIMPLE_MODE === 'true';

const queriedAddresses = new Set();

const SHIBA_RIG_ADDRESS = process.env.SHIBA_RIG_ADDRESS || '0x86Ae97f9245c592d2cDA14D1BC31104228eAE569';
const PEPE_RIG_ADDRESS = process.env.PEPE_RIG_ADDRESS || '0x26AB793aD774944403b29dE4eC44060bCb7e4735';

const UNIQUE_MINING_RIG_ADDRESSES = [];

try {
  const shibaChecksummed = ethers.getAddress(SHIBA_RIG_ADDRESS);
  UNIQUE_MINING_RIG_ADDRESSES.push({ 
    address: shibaChecksummed, 
    name: 'SHIBA' 
  });
} catch (error) {
  console.error('❌ Invalid SHIBA_RIG_ADDRESS:', SHIBA_RIG_ADDRESS);
}

try {
  const pepeChecksummed = ethers.getAddress(PEPE_RIG_ADDRESS);
  UNIQUE_MINING_RIG_ADDRESSES.push({ 
    address: pepeChecksummed, 
    name: 'PEPE' 
  });
} catch (error) {
  console.error('❌ Invalid PEPE_RIG_ADDRESS:', PEPE_RIG_ADDRESS);
}

console.log('🔧 Named Rig Configuration:');
console.log(`  SHIBA: ${SHIBA_RIG_ADDRESS}`);
console.log(`  PEPE: ${PEPE_RIG_ADDRESS}`);
console.log(`  SIMPLE_MODE: ${SIMPLE_MODE ? 'ENABLED' : 'DISABLED'}`);

let provider;
if (RPC_URL) {
  provider = new ethers.JsonRpcProvider(RPC_URL);
}

const MINING_RIG_ABI = [
  "function score(address _address) external view returns(uint)",
  "function getTotalMiningTxs(address _address) external view returns(uint256)",
  "function scores(address) external view returns(uint256 base, uint256 balance, uint256 frequency, uint256 held, uint256 debt, uint256 redeemable, uint256 totalMiningTxs)"
];

if (provider && UNIQUE_MINING_RIG_ADDRESSES.length) {
  app.locals.miningRigContracts = UNIQUE_MINING_RIG_ADDRESSES.map((rigInfo) => ({
    address: rigInfo.address,
    name: rigInfo.name,
    contract: new ethers.Contract(rigInfo.address, MINING_RIG_ABI, provider)
  }));
  console.log('✅ Configured Mining Rigs:', app.locals.miningRigContracts.map(r => `${r.name || 'Unknown'} (${r.address})`).join(', '));
}

function getMiningRigContracts(req) {
  const contracts = req.app.locals.miningRigContracts;
  if (!contracts || contracts.length === 0) {
    throw new Error('MiningRig contracts not configured');
  }
  return contracts;
}

async function evaluateContract(entry, walletAddress) {
  const { contract } = entry;
  const scoreData = await contract.scores(walletAddress);
  const hasMined = scoreData && scoreData.base !== undefined && scoreData.base > 0n;

  if (!hasMined) {
    return { hasMined: false };
  }

  try {
    const computedScore = await contract.score(walletAddress);
    return { hasMined: true, scoreData, computedScore };
  } catch (error) {
    return { hasMined: false };
  }
}

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    contract: UNIQUE_MINING_RIG_ADDRESSES[0] || null,
    contracts: UNIQUE_MINING_RIG_ADDRESSES
  });
});

app.get('/api/verify/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;

    if (!ethers.isAddress(walletAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid wallet address'
      });
    }

    if (SIMPLE_MODE) {
      const normalizedAddress = walletAddress.toLowerCase();
      if (queriedAddresses.has(normalizedAddress)) {
        return res.status(400).json({
          success: false,
          message: 'You already did this or have not mined'
        });
      }
    }

    const contracts = getMiningRigContracts(req);
    let lastError;
    let highestScore = 0n;
    let highestScoreRig = null;
    let highestScoreData = null;

    for (const entry of contracts) {
      try {
        const evaluation = await evaluateContract(entry, walletAddress);

        if (!evaluation.hasMined) {
          continue;
        }

        const { scoreData, computedScore } = evaluation;

        if (computedScore > highestScore) {
          highestScore = computedScore;
          highestScoreRig = entry;
          highestScoreData = scoreData;
        }
      } catch (error) {
        lastError = error;
        console.error('Error evaluating contract:', error);
      }
    }

    if (highestScoreRig && highestScoreData) {
      if (SIMPLE_MODE) {
        queriedAddresses.add(walletAddress.toLowerCase());
        return res.status(200).json({
          success: true,
          message: `Pass - Your score is ${highestScore.toString()}`
        });
      }

      return res.json({
        success: true,
        hasMined: true,
        contractAddress: highestScoreRig.address,
        rigName: highestScoreRig.name || 'Unknown',
        data: {
          walletAddress: walletAddress,
          hasMined: true,
          rigName: highestScoreRig.name || 'Unknown',
          score: highestScore.toString(),
          totalMiningTxs: highestScoreData.totalMiningTxs.toString(),
          scores: {
            base: highestScoreData.base.toString(),
            balance: highestScoreData.balance.toString(),
            frequency: highestScoreData.frequency.toString(),
            held: highestScoreData.held.toString(),
            debt: highestScoreData.debt.toString(),
            redeemable: highestScoreData.redeemable.toString()
          }
        }
      });
    }

    if (lastError) {
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: lastError.message
      });
    }

    if (SIMPLE_MODE) {
      return res.status(400).json({
        success: false,
        message: 'Fail - Your score is 0'
      });
    }

    res.json({
      success: false,
      hasMined: false,
      message: 'User has not mined yet',
      data: {
        hasMined: false
      }
    });

  } catch (error) {
    console.error('Error verifying mining status:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

app.get('/api/verify/:walletAddress/min-txs/:minTxs', async (req, res) => {
  try {
    const { walletAddress, minTxs } = req.params;

    if (!ethers.isAddress(walletAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid wallet address'
      });
    }

    const contracts = getMiningRigContracts(req);

    const minimumTxs = parseInt(minTxs);
    if (isNaN(minimumTxs) || minimumTxs < 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid minimum transactions value'
      });
    }

    let firstMinedResult = null;
    let lastError;

    for (const entry of contracts) {
      try {
        const evaluation = await evaluateContract(entry, walletAddress);

        if (!evaluation.hasMined) {
          continue;
        }

        const { scoreData, computedScore } = evaluation;
        const totalTxs = Number(scoreData.totalMiningTxs);

        if (!firstMinedResult) {
          firstMinedResult = {
            entry,
            scoreData,
            computedScore,
            totalTxs
          };
        }

        if (totalTxs >= minimumTxs) {
          return res.json({
            success: true,
            hasMined: true,
            contractAddress: entry.address,
            rigName: entry.name || 'Unknown',
            totalMiningTxs: totalTxs,
            requiredTxs: minimumTxs,
            meetsRequirement: true,
            data: {
              walletAddress: walletAddress,
              hasMined: true,
              rigName: entry.name || 'Unknown',
              score: computedScore.toString()
            }
          });
        }
      } catch (error) {
        lastError = error;
        console.error('Error verifying mining transactions:', error);
      }
    }

    if (lastError) {
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: lastError.message
      });
    }

    if (!firstMinedResult) {
      return res.json({
        success: false,
        hasMined: false,
        totalMiningTxs: 0,
        requiredTxs: minimumTxs,
        message: 'User has not mined yet',
        data: {
          hasMined: false
        }
      });
    }

    return res.json({
      success: false,
      hasMined: true,
      contractAddress: firstMinedResult.entry.address,
      rigName: firstMinedResult.entry.name || 'Unknown',
      totalMiningTxs: firstMinedResult.totalTxs,
      requiredTxs: minimumTxs,
      meetsRequirement: false,
      data: {
        walletAddress: walletAddress,
        hasMined: true,
        rigName: firstMinedResult.entry.name || 'Unknown',
        score: firstMinedResult.computedScore.toString()
      }
    });

  } catch (error) {
    console.error('Error verifying mining transactions:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

app.get('/api/verify/:walletAddress/min-score/:minScore', async (req, res) => {
  try {
    const { walletAddress, minScore } = req.params;

    if (!ethers.isAddress(walletAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid wallet address'
      });
    }

    const contracts = getMiningRigContracts(req);

    let requiredScore;
    try {
      requiredScore = BigInt(minScore);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid minimum score value'
      });
    }

    let firstMinedResult = null;
    let lastError;

    for (const entry of contracts) {
      try {
        const evaluation = await evaluateContract(entry, walletAddress);

        if (!evaluation.hasMined) {
          continue;
        }

        const { scoreData, computedScore } = evaluation;

        if (!firstMinedResult) {
          firstMinedResult = {
            entry,
            scoreData,
            computedScore
          };
        }

        const meetsRequirement = computedScore >= requiredScore;

        if (meetsRequirement) {
          return res.json({
            success: true,
            hasMined: true,
            contractAddress: entry.address,
            rigName: entry.name || 'Unknown',
            score: computedScore.toString(),
            requiredScore: requiredScore.toString(),
            meetsRequirement: true,
            data: {
              walletAddress: walletAddress,
              hasMined: true,
              rigName: entry.name || 'Unknown',
              totalMiningTxs: scoreData.totalMiningTxs.toString()
            }
          });
        }
      } catch (error) {
        lastError = error;
        console.error('Error verifying mining score:', error);
      }
    }

    if (lastError) {
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: lastError.message
      });
    }

    if (!firstMinedResult) {
      return res.json({
        success: false,
        hasMined: false,
        score: '0',
        requiredScore: requiredScore.toString(),
        message: 'User has not mined yet',
        data: {
          hasMined: false
        }
      });
    }

    return res.json({
      success: false,
      hasMined: true,
      contractAddress: firstMinedResult.entry.address,
      rigName: firstMinedResult.entry.name || 'Unknown',
      score: firstMinedResult.computedScore.toString(),
      requiredScore: requiredScore.toString(),
      meetsRequirement: false,
      data: {
        walletAddress: walletAddress,
        hasMined: true,
        rigName: firstMinedResult.entry.name || 'Unknown',
        totalMiningTxs: firstMinedResult.scoreData.totalMiningTxs.toString()
      }
    });

  } catch (error) {
    console.error('Error verifying mining score:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

app.post('/api/verify/batch', async (req, res) => {
  try {
    const { walletAddresses } = req.body;

    if (!Array.isArray(walletAddresses) || walletAddresses.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request: walletAddresses must be a non-empty array'
      });
    }

    const contracts = getMiningRigContracts(req);

    const results = await Promise.all(
      walletAddresses.map(async (address) => {
        try {
          if (!ethers.isAddress(address)) {
            return {
              walletAddress: address,
              success: false,
              error: 'Invalid address'
            };
          }

          let lastError;

          for (const entry of contracts) {
            try {
              const evaluation = await evaluateContract(entry, address);

              if (!evaluation.hasMined) {
                continue;
              }

              const { scoreData, computedScore } = evaluation;

              return {
                walletAddress: address,
                success: true,
                hasMined: true,
                contractAddress: entry.address,
                rigName: entry.name || 'Unknown',
                data: {
                  hasMined: true,
                  rigName: entry.name || 'Unknown',
                  score: computedScore.toString(),
                  totalMiningTxs: scoreData.totalMiningTxs.toString()
                }
              };
            } catch (error) {
              lastError = error;
              console.error('Error evaluating batch mining status:', error);
            }
          }

          if (lastError) {
            return {
              walletAddress: address,
              success: false,
              error: lastError.message
            };
          }

          return {
            walletAddress: address,
            success: false,
            hasMined: false,
            data: {
              hasMined: false
            }
          };
        } catch (error) {
          return {
            walletAddress: address,
            success: false,
            error: error.message
          };
        }
      })
    );

    res.json({
      success: true,
      results: results
    });

  } catch (error) {
    console.error('Error in batch verification:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Zealy Mining Verification API running on port ${PORT}`);
    if (UNIQUE_MINING_RIG_ADDRESSES.length) {
      console.log(`📝 Contract Addresses: ${UNIQUE_MINING_RIG_ADDRESSES.join(', ')}`);
    } else {
      console.log('📝 Contract Addresses: not configured');
    }
    console.log(`🔗 RPC URL: ${RPC_URL}`);
    console.log(`\nAvailable endpoints:`);
    console.log(`  GET  /health`);
    console.log(`  GET  /api/verify/:walletAddress`);
    console.log(`  GET  /api/verify/:walletAddress/min-txs/:minTxs`);
    console.log(`  GET  /api/verify/:walletAddress/min-score/:minScore`);
    console.log(`  POST /api/verify/batch`);
  });
}

module.exports = app;
