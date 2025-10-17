# Zealy Miner Score API

Node.js API that verifies MiningRig activity and provides Zealy-compatible endpoints for quest integration. Supports multiple MiningRig contracts with automatic fallback, comprehensive mining statistics, and flexible verification criteria for when Star System Labs goes multi-chain.

## 🎯 What This API Does

This API bridges your MiningRig smart contracts with Zealy quests by:
- ✅ **Verifying** if a wallet has mined on SHIBA or PEPE mining rigs
- 📊 **Retrieving** detailed mining scores and transaction statistics
- 🎯 **Validating** minimum transaction or score requirements for quest completion
- 🔄 **Supporting** two mining rigs (SHIBA & PEPE) with automatic fallback
- 🚀 **Providing** Zealy-compatible JSON responses with rig identification

## 📋 Table of Contents

- [How It Works](#how-it-works)
- [Quick Start](#quick-start)
- [API Response Structure](#api-response-structure)
- [API Endpoints](#api-endpoints)
- [Zealy Integration Guide](#zealy-integration-guide)
- [Multi-Contract Support](#multi-contract-support)
- [Testing](#testing)
- [Deployment](#deployment)

## 🔧 How It Works

### Request Flow

1. **User Completes Quest** - User connects their wallet to Zealy and attempts a quest
2. **Zealy Calls API** - Zealy sends a GET request to your API with the user's wallet address
3. **API Queries Contracts** - Your API queries each configured MiningRig contract via RPC
4. **Contract Returns Data** - Smart contract returns mining scores and transaction count
5. **API Processes Response** - API formats data into Zealy-compatible JSON
6. **Zealy Validates** - Zealy checks if response meets quest requirements
7. **Quest Completion** - User receives XP and rewards if requirements are met

### Two Mining Rigs: SHIBA & PEPE

The API supports **two named mining rigs** configured via environment variables:

```env
SHIBA_RIG_ADDRESS=0x86Ae97f9245c592d2cDA14D1BC31104228eAE569
PEPE_RIG_ADDRESS=0x26AB793aD774944403b29dE4eC44060bCb7e4735
```

**How it works:**
1. API automatically loads both SHIBA and PEPE rig addresses
2. Checks the **SHIBA rig** first for mining activity
3. If user hasn't mined there, checks the **PEPE rig**
4. Returns data from the **first matching rig** including the rig name
5. If no mining found on either rig, returns `hasMined: false`

**Response includes rig identification:**
- `rigName: "SHIBA"` or `rigName: "PEPE"`
- Helps users and admins identify which token was mined
- Useful for quest targeting specific rigs

**Configuration is simple:**
- No need to maintain a list of addresses
- Just set the individual rig addresses
- Default mainnet addresses provided if not set

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18.0.0 or higher
- **Ethereum RPC endpoint** (Infura, Alchemy, QuickNode, or similar)
- **MiningRig contract address(es)** - Your deployed smart contract(s)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/star-system-labs/zealy-miner-score
cd zealy-miner-score
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file from the example:
```bash
cp .env.example .env
```

4. Configure your `.env` file:
```env
PORT=3000
RPC_URL=https://mainnet.infura.io/v3/YOUR_INFURA_KEY

# Mining Rig Addresses (Optional - defaults provided)
SHIBA_RIG_ADDRESS=0x86Ae97f9245c592d2cDA14D1BC31104228eAE569
PEPE_RIG_ADDRESS=0x26AB793aD774944403b29dE4eC44060bCb7e4735
```

**Important:** 
- The API uses only the individual rig addresses (no list needed!)
- Default mainnet addresses are provided if not set
- To use different addresses (testnet, upgraded contracts), simply set the environment variables

## Usage

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The API will start on the port specified in your `.env` file (default: 3000).

## 📊 API Response Structure

### Standard Response Format

All endpoints follow a consistent structure with `hasMined` flags at both the top level and within the `data` object.

#### ✅ When User Has Mined

```json
{
  "success": true,
  "hasMined": true,
  "contractAddress": "0x86Ae97f9245c592d2cDA14D1BC31104228eAE569",
  "rigName": "SHIBA",
  "data": {
    "walletAddress": "0xB814aE6b2F368E8E8392B7D897044677f5f8bE2b",
    "hasMined": true,
    "rigName": "SHIBA",
    "score": "1234567890",
    "totalMiningTxs": "42",
    "scores": {
      "base": "1000000",
      "balance": "500000",
      "frequency": "200000",
      "held": "100000",
      "debt": "0",
      "redeemable": "1800000"
    }
  }
}
```

#### ❌ When User Has NOT Mined

```json
{
  "success": false,
  "hasMined": false,
  "message": "User has not mined yet",
  "data": {
    "hasMined": false
  }
}
```

### Response Fields Explained

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Overall request success (true if user has mined) |
| `hasMined` | boolean | Top-level mining status flag |
| `contractAddress` | string | Which MiningRig contract the user mined on |
| `rigName` | string | Name of the rig: "SHIBA" or "PEPE" |
| `data.hasMined` | boolean | Mining status within data object |
| `data.rigName` | string | Name of the rig within data object |
| `data.score` | string | Computed mining score (BigInt as string) |
| `data.totalMiningTxs` | string | Total mining transactions |
| `data.scores.base` | string | Base score component |
| `data.scores.balance` | string | Token balance component |
| `data.scores.frequency` | string | Mining frequency bonus |
| `data.scores.held` | string | Held tokens component |
| `data.scores.debt` | string | Debt component |
| `data.scores.redeemable` | string | Redeemable amount |

**Note:** When `hasMined: false`, only the `hasMined` flag is present in the `data` object. No score details are included.

## API Endpoints

### 1. Health Check
```
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-10-16T12:37:40.000Z",
  "contract": "0x..."
}
```

### 2. Verify Mining Status
```
GET /api/verify/:walletAddress
```

**Parameters:**
- `walletAddress` - The Ethereum wallet address to verify

**Query Parameters (Optional):**
- `rigAddress` - Filter to a specific MiningRig contract address

**Example:**
```bash
curl https://your-api.com/api/verify/0xB814aE6b2F368E8E8392B7D897044677f5f8bE2b
```

**Response:** See [API Response Structure](#api-response-structure) above

### 3. Verify Minimum Transactions
```
GET /api/verify/:walletAddress/min-txs/:minTxs
```

**Parameters:**
- `walletAddress` - The Ethereum wallet address to verify
- `minTxs` - Minimum number of mining transactions required

**Example:**
```bash
curl https://your-api.com/api/verify/0xWallet/min-txs/10
```

**Response:**
```json
{
  "success": true,
  "hasMined": true,
  "contractAddress": "0x...",
  "totalMiningTxs": 15,
  "requiredTxs": 10,
  "meetsRequirement": true,
  "data": {
    "walletAddress": "0x...",
    "hasMined": true,
    "score": "123456789"
  }
}
```

### 4. Verify Minimum Score
```
GET /api/verify/:walletAddress/min-score/:minScore
```

**Parameters:**
- `walletAddress` - The Ethereum wallet address to verify
- `minScore` - Minimum score required

**Example:**
```bash
curl https://your-api.com/api/verify/0xWallet/min-score/1000000
```

**Response:**
```json
{
  "success": true,
  "hasMined": true,
  "contractAddress": "0x...",
  "score": "1234567",
  "requiredScore": "1000000",
  "meetsRequirement": true,
  "data": {
    "walletAddress": "0x...",
    "hasMined": true,
    "totalMiningTxs": "42"
  }
}
```

### 5. Batch Verification
```
POST /api/verify/batch
```

**Request Body:**
```json
{
  "walletAddresses": [
    "0xAddress1...",
    "0xAddress2...",
    "0xAddress3..."
  ]
}
```

**Example:**
```bash
curl -X POST https://your-api.com/api/verify/batch \
  -H "Content-Type: application/json" \
  -d '{"walletAddresses": ["0xAddr1", "0xAddr2"]}'
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "walletAddress": "0xAddress1...",
      "success": true,
      "hasMined": true,
      "contractAddress": "0x...",
      "data": {
        "hasMined": true,
        "score": "123456789",
        "totalMiningTxs": "5"
      }
    },
    {
      "walletAddress": "0xAddress2...",
      "success": false,
      "hasMined": false,
      "data": {
        "hasMined": false
      }
    }
  ]
}
```

## 🎮 Zealy Integration Guide

### Overview

Zealy's Custom API quests allow you to verify on-chain activity and reward users for completing specific actions. This API provides everything needed to create mining-based quests.

### Step-by-Step Setup

#### 1. Deploy Your API

First, deploy your API to a public URL (see [Deployment](#deployment) section). You'll need:
- ✅ Public HTTPS URL (e.g., `https://your-api.railway.app`)
- ✅ Configured MiningRig contract addresses
- ✅ Valid RPC endpoint

#### 2. Create a Custom API Quest in Zealy

1. **Navigate to your Zealy community dashboard**
2. **Click "Create Quest" → "Custom API"**
3. **Configure the quest settings:**

**Quest Configuration:**

| Setting | Value |
|---------|-------|
| **Quest Name** | "Complete Your First Mining Transaction" |
| **Description** | "Mine tokens using our MiningRig contract to earn XP" |
| **XP Reward** | 100 (or your choice) |
| **Quest Type** | Custom API |

#### 3. Configure API Settings

**API Configuration:**

```
Method: GET
URL: https://your-api.railway.app/api/verify/{{wallet_address}}
```

**Important:** Use Zealy's variable `{{wallet_address}}` which automatically inserts the user's connected wallet.

**Success Conditions:**

Add these conditions in Zealy's success criteria:
```
response.success == true
response.hasMined == true
```

**Alternative (simpler):**
```
response.success == true
```

#### 4. Test Your Quest

1. **Connect your wallet** in Zealy
2. **Attempt the quest**
3. **Verify the API is called** (check your API logs)
4. **Confirm quest completion** if you've mined

### Troubleshooting Zealy Integration

| Issue | Solution |
|-------|----------|
| Quest not completing | Check API logs for errors, verify wallet is connected |
| "API Error" in Zealy | Ensure API is publicly accessible via HTTPS |
| Wrong wallet checked | Verify `{{wallet_address}}` variable is used correctly |
| Slow verification | Check RPC endpoint performance, consider caching |
| User hasn't mined | Provide clear instructions on how to mine |

### Testing Your Integration

Before going live:

1. **Test with your own wallet:**
   ```bash
   curl https://your-api.com/api/verify/YOUR_WALLET_ADDRESS
   ```

2. **Verify response format** matches Zealy expectations

3. **Test in Zealy** with a test community first

4. **Monitor API logs** during initial rollout

5. **Gather user feedback** and iterate

## 🧪 Testing

### Local Testing

#### 1. Run Tests with Mock Contracts
```bash
npm test
```

#### 2. Run Tests with Hardhat Fork
```bash
npm run test:fork
```

**Requirements:**
- `RPC_URL` must be set in `.env`
- Valid MiningRig contract addresses configured

**How it works:**
1. Starts Hardhat node forking from mainnet (random port 40000-50000)
2. Runs tests against the forked chain
3. Automatically cleans up after completion

### Manual API Testing

#### Test Health Endpoint
```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-10-16T...",
  "contract": "0x...",
  "contracts": ["0x...", "0x..."]
}
```

#### Test Verification Endpoint
```bash
# Replace with a wallet that has mined
curl http://localhost:3000/api/verify/0xYourWalletAddress
```

#### Test with Query Parameters
```bash
# Filter to specific contract
curl "http://localhost:3000/api/verify/0xWallet?rigAddress=0xSpecificRig"
```

### Testing with Postman

Import this collection to test all endpoints:

1. **Create a new collection** in Postman
2. **Set base URL** variable: `http://localhost:3000`
3. **Add these requests:**

```
GET {{baseUrl}}/health
GET {{baseUrl}}/api/verify/:walletAddress
GET {{baseUrl}}/api/verify/:walletAddress/min-txs/:minTxs
GET {{baseUrl}}/api/verify/:walletAddress/min-score/:minScore
POST {{baseUrl}}/api/verify/batch
```

## Smart Contract Integration

The API reads from the MiningRig smart contract using these functions:

- `scores(address)` - Returns complete mining data for an address
- `score(address)` - Returns the computed score (reverts if user hasn't mined)
- `getTotalMiningTxs(address)` - Returns total mining transactions

### Score Calculation

The mining score is calculated from:
- **Base:** Liquidity-based component with difficulty adjustment
- **Balance:** Current PPEPE token balance
- **Frequency:** Mining transaction frequency (exponential bonus)
- **Held:** MEME tokens held


## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error type",
  "message": "Detailed error message"
}
```

Common error codes:
- `400` - Invalid request parameters
- `404` - Endpoint not found
- `500` - Internal server error (blockchain connection issues, etc.)


## 📁 Project Structure

```
zealy-miner-score/
├── src/
│   └── index.js                    # Main API server with all endpoints
├── tests/
│   └── api.test.js                 # Comprehensive test suite
├── scripts/
│   └── run-tests-with-fork.js      # Hardhat fork test runner
├── examples/
│   └── test-api.js                 # Example API usage
├── hardhat.config.js               # Hardhat configuration for testing
├── .env.example                    # Example environment configuration
├── package.json                    # Dependencies and scripts
├── API_RESPONSE_FORMAT.md          # Detailed response format documentation
└── README.md                       # This file
```

## 📄 License

MIT License

Copyright (c) 2025 Star System Labs / 0xcircuitbreaker

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

IMPORTANT: While not legally binding, we kindly request maintaining attribution
to 0xcircuitbreaker and Star System Labs in derivatives of this work.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---