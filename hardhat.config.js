require('@nomicfoundation/hardhat-ethers');
require('dotenv').config();

const FORK_RPC_URL = process.env.MAINNET_FORK_RPC_URL || process.env.ALCHEMY_MAINNET_URL || process.env.INFURA_MAINNET_URL;
const FORK_BLOCK = process.env.MAINNET_FORK_BLOCK ? Number(process.env.MAINNET_FORK_BLOCK) : undefined;

/** @type import('hardhat/config').HardhatUserConfig */
const config = {
  solidity: {
    version: '0.8.23',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {
      chainId: 1,
      forking: FORK_RPC_URL
        ? {
            url: FORK_RPC_URL,
            blockNumber: Number.isFinite(FORK_BLOCK) ? FORK_BLOCK : undefined
          }
        : undefined
    }
  }
};

module.exports = config;
