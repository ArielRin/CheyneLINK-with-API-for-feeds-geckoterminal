require("dotenv").config();
const ethers = require("ethers");
const axios = require("axios");

// Load Environment Variables
const {
  RPC_URL,
  BOT_PRIVATE_KEY,
  CONTRACT_ADDRESS,
  BOT_WALLET_ADDRESS,
  TOKEN_NAME,
  TOKEN_SYMBOL,
  TOKEN_ADDRESS,
  TOKEN_DECIMALS,
  GECKOTERMINAL_API_URL,
  PRICE_CHANGE_THRESHOLD,
  DEFAULT_GAS_LIMIT,
  MAX_FEE_PER_GAS_GWEI,
  CHECK_INTERVAL,
} = process.env;

// Set up constants and conversion factors
const THRESHOLD_PERCENT = ethers.utils.parseUnits(PRICE_CHANGE_THRESHOLD.toString(), 4); // Scaled to four decimals
const DEFAULT_GAS_LIMIT_HEX = ethers.utils.hexlify(parseInt(DEFAULT_GAS_LIMIT, 10));
const INITIAL_GAS_PRICE = ethers.utils.parseUnits(MAX_FEE_PER_GAS_GWEI, "gwei");
const GAS_INCREMENT = ethers.utils.parseUnits("1", "gwei");

let latestFetchedPrice = null; // To store the latest fetched price

// Initialize provider, wallet, and contract
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(BOT_PRIVATE_KEY, provider);
const contractABI = [
  "function updatePrice(uint256 newPrice) external",
  "function getPrice() view returns (uint256)",
  "function transferOwnership(address newOwner) external",
  "function owner() view returns (address)"
];
const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, wallet);

let transactionCount = 0;
let isUpdating = false;

// Display bot header
function showHeader() {
  console.clear();
  console.log("CheyneLINK Price Feed Bot\n");
  console.log(`Token: ${TOKEN_NAME} (${TOKEN_SYMBOL})`);
  console.log(`Price Change Threshold: ±${ethers.utils.formatUnits(THRESHOLD_PERCENT /1000, 4)}%`);
  console.log("-------------------------------------------------------------");
}

// Display bot wallet balance
async function displayBotBalance() {
  try {
    const balance = await provider.getBalance(BOT_WALLET_ADDRESS);
    console.log(`Bot's Wallet Balance: ${ethers.utils.formatEther(balance)} ETH`);
  } catch (error) {
    console.error("Error fetching wallet balance:", error);
  }
}

async function fetchTokenPrice() {
  if (!GECKOTERMINAL_API_URL) {
    console.error("Error: GECKOTERMINAL_API_URL is not defined in the environment variables.");
    return null;
  }

  try {
    const url = GECKOTERMINAL_API_URL
      .replace("{network}", "ethereum") // Adjust network if needed
      .replace("{token_address}", TOKEN_ADDRESS);

    const response = await axios.get(url);
    const priceData = response.data;

    // Access the price from the nested structure in response
    const tokenPrices = priceData.data.attributes.token_prices;
    const tokenPrice = tokenPrices[TOKEN_ADDRESS.toLowerCase()];

    if (tokenPrice) {
      return ethers.utils.parseUnits(tokenPrice, 8); // Parsed to 8 decimals
    } else {
      console.error("Error: Token price not found in response:", priceData);
      return null;
    }
  } catch (error) {
    if (error.response && error.response.status === 429) {
      const retryAfter = error.response.headers['retry-after'];
      const retrySeconds = parseInt(retryAfter, 10) || 60;
      console.error(`Rate limit exceeded. Retrying in ${retrySeconds} seconds...`);

      await new Promise(resolve => setTimeout(resolve, retrySeconds * 1000));
      return fetchTokenPrice(); // Retry the function
    } else {
      console.error("Error fetching token price from GeckoTerminal API:", error);
      return null;
    }
  }
}

// Update price on-chain with retry logic for gas pricing and nonce
async function updatePriceOnChain(newPrice, gasPrice = INITIAL_GAS_PRICE) {
  if (isUpdating) return;

  isUpdating = true;
  try {
    const nonce = await provider.getTransactionCount(wallet.address, "latest");
    const txOptions = { nonce, gasLimit: DEFAULT_GAS_LIMIT_HEX, gasPrice };

    const tx = await contract.updatePrice(newPrice, txOptions);
    console.log("Transaction sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("Transaction confirmed:", receipt.transactionHash);

    transactionCount++;
  } catch (error) {
    await handleUpdateError(error, newPrice, gasPrice);
  } finally {
    isUpdating = false;
  }
}

// Handle errors in updatePriceOnChain with custom retry logic
async function handleUpdateError(error, newPrice, gasPrice) {
  if (error.code === 'REPLACEMENT_UNDERPRICED') {
    console.log("Increasing gas price and retrying...");
    await updatePriceOnChain(newPrice, gasPrice.add(GAS_INCREMENT));
  } else if (error.code === 'NONCE_EXPIRED') {
    console.log("Retrying with latest nonce...");
    await updatePriceOnChain(newPrice, gasPrice);
  } else if (error.code === 'UNSUPPORTED_OPERATION') {
    console.log("Retrying with fallback gas price...");
    await updatePriceOnChain(newPrice, ethers.utils.parseUnits("20", "gwei"));
  } else {
    console.error("Failed to update price on-chain:", error);
  }
}

// Main function to start bot and handle intervals
async function main() {
  showHeader();
  await displayBotBalance();

  // Fetch price every 19 seconds
  setInterval(async () => {
    latestFetchedPrice = await fetchTokenPrice();
    if (latestFetchedPrice) {
      console.log(`Fetched Live Price: $${ethers.utils.formatUnits(latestFetchedPrice, 8)}`);
    }
  }, 19000); // 19 seconds

  // Update on-chain price based on CHECK_INTERVAL
  setInterval(async () => {
    if (latestFetchedPrice) {
      const onChainPrice = await fetchOnChainPrice();
      if (onChainPrice) {
        const priceDifference = latestFetchedPrice.sub(onChainPrice).abs();
        const thresholdValue = latestFetchedPrice.mul(THRESHOLD_PERCENT).div(10000000);

        showHeader();
        console.log(`Live Price Feed: $${ethers.utils.formatUnits(latestFetchedPrice, 8)}`);
        console.log(`On-Chain Price: $${ethers.utils.formatUnits(onChainPrice, 8)}`);
        console.log(`Threshold Value: ±$${ethers.utils.formatUnits(thresholdValue, 8)}`);
        console.log(`Session Transactions: ${transactionCount}`);

        // Update on-chain price, regardless of threshold
        await updatePriceOnChain(latestFetchedPrice);
      }
    }
  }, parseInt(CHECK_INTERVAL, 10) * 1000); // CHECK_INTERVAL in seconds
}

// Fetch current on-chain price with error handling
async function fetchOnChainPrice() {
  try {
    const price = await contract.getPrice();
    return price;
  } catch (error) {
    console.error("Error fetching on-chain price:", {
      message: error.message,
      code: error.code,
      reason: error.reason,
      data: error.data,
    });
    return null;
  }
}

main();
