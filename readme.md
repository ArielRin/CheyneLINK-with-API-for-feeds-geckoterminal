
# CheyneLINK Price Feed

CheyneLINK is a Node.js bot that monitors the price of a specified token on the GeckoTerminal API and updates it on-chain using an Ethereum smart contract. This bot is designed to work seamlessly on Linode for constant uptime and ensures secure interaction with your blockchain contract.

## Project Overview

- **Contract**: A secure Ethereum contract that stores the price and only allows updates from the authorized bot wallet.
- **Bot Script**: Node.js script that regularly fetches token prices and updates the contract when the price change meets a specified threshold.
- **Environment Variables**: Manage configuration for the bot securely using `.env`.
- **Deployment**: Hosted on Linode for reliable uptime, managed by PM2 to restart automatically on server reboot.


![CheyneLINK Bot Overview](./Guides/cheynelink.png)
---

## Prerequisites

1. **Linode Account**: $5 plan or above is recommended.
2. **Node.js and npm** installed on your Linode instance.
3. **GitHub Repository**: Clone this bot code from GitHub.

## Project Setup

### 1. Contract Deployment

Deploy the provided `CheyneLinkPriceFeed` contract to your Ethereum-compatible network and save the contract address.

### 2. Environment Configuration

Create a `.env` file in the root directory of your project. Use the following template:

```plaintext
# RPC URL for Ethereum node
RPC_URL=https://mainnet.base.org

# Wallet and Contract Configuration
BOT_PRIVATE_KEY=YOUR_BOT_PRIVATE_KEY
BOT_WALLET_ADDRESS=YOUR_BOT_WALLET_ADDRESS
CONTRACT_ADDRESS=YOUR_CONTRACT_ADDRESS

# Token Information
TOKEN_NAME="TESTICALLLS Token"
TOKEN_SYMBOL="BALLZ"
TOKEN_ADDRESS=0x4ea98c1999575aaadfb38237dd015c5e773f75a2
TOKEN_DECIMALS=18
GECKOTERMINAL_API_URL=https://api.geckoterminal.com/api/v2/simple/networks/bsc/token_price/0x4ea98c1999575aaadfb38237dd015c5e773f75a2

# Bot Configuration
CHECK_INTERVAL=15000  # Check every 15 seconds
PRICE_CHANGE_THRESHOLD=100  # 100 = 1% price change
SCALE_FACTOR=10000

# Gas Configuration
MAX_FEE_PER_GAS_GWEI=1
MAX_PRIORITY_FEE_PER_GAS_GWEI=1
DEFAULT_GAS_LIMIT=100000
```

### 3. Clone the Project

1. SSH into your Linode instance and clone the GitHub repository:
   ```bash
   ssh root@your-linode-ip-address
   git clone https://github.com/yourusername/CheyneLINK-Price-feed-bot.git
   cd CheyneLINK-Price-feed-bot
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up the environment variables by creating a `.env` file in the root and pasting your configuration from Step 2.

### 4. Script Explanation

The script performs the following actions:

1. **Header**: Displays information about the monitored token.
2. **Ownership Check**: Transfers contract ownership to the bot wallet if necessary.
3. **Balance Check**: Displays the bot's ETH balance with a green circle if adequate or a red "X" if low.
4. **Fetch Price**: Retrieves the token price from GeckoTerminal.
5. **Price Update**: Updates the contract if the price difference exceeds the set threshold.
6. **Countdown Timer**: Initiates the next fetch based on the `CHECK_INTERVAL`.

### 5. Run the Bot

Start the bot manually to confirm it’s working as expected:
```bash
node your-bot-script.js
```


![CheyneLINK Feed Running](./Guides/bot.png)

### 6. Set Up PM2 for Process Management

To ensure the bot runs continuously, even after a server reboot, use PM2:

1. **Install PM2**:
   ```bash
   sudo npm install -g pm2
   ```

2. **Start the Bot**:
   ```bash
   pm2 start your-bot-script.js --name "CheyneLinkBot"
   ```

3. **Save the PM2 State**:
   ```bash
   pm2 save
   ```

4. **Enable PM2 to Start on Boot**:
   ```bash
   pm2 startup
   ```

5. **Monitor the Bot**:
   - To check logs:
     ```bash
     pm2 logs CheyneLinkBot
     ```
   - To restart after changes:
     ```bash
     pm2 restart CheyneLinkBot
     ```

---

## Usage

The bot continuously monitors the price based on the interval set in `.env`. If the price change meets the threshold, it updates the contract on-chain, ensuring that only significant price fluctuations trigger a transaction.

### On Server Reboot

With PM2 configured, the bot will automatically restart on server boot, making it suitable for long-term, stable price monitoring.

---

## Troubleshooting

- **Ownership Transfer**: Ensure the bot wallet is funded and authorized to interact with the contract.
- **Gas Limit Issues**: Increase `DEFAULT_GAS_LIMIT` if transactions fail.
- **Low Balance Warning**: If the balance shows a red "X", add funds to avoid transaction failures.

For further questions, refer to the contract and script comments in the project files.
