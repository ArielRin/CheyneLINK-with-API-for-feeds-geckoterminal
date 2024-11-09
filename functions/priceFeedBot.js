require("dotenv").config();
const ethers = require("ethers");
const axios = require("axios");

const {
  RPC_URL,
  BOT_PRIVATE_KEY,
  CONTRACT_ADDRESS,
  BOT_WALLET_ADDRESS,
  TOKEN_NAME,
  TOKEN_SYMBOL,
  TOKEN_ADDRESS,
  GECKOTERMINAL_API_URL,
  PRICE_CHANGE_THRESHOLD,
  DEFAULT_GAS_LIMIT,
  MAX_FEE_PER_GAS_GWEI,
  CHECK_INTERVAL,
  TOKEN_DECIMALS = 18,
} = process.env;

// Constants for thresholds and gas
const THRESHOLD_PERCENT = ethers.utils.parseUnits(PRICE_CHANGE_THRESHOLD, 4);
const DEFAULT_GAS_LIMIT_HEX = ethers.utils.hexlify(parseInt(DEFAULT_GAS_LIMIT, 10));
const INITIAL_GAS_PRICE = ethers.utils.parseUnits(MAX_FEE_PER_GAS_GWEI, "gwei");

let transactionCount = 0;
let latestFetchedPrice = null;
let isUpdating = false;

const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(BOT_PRIVATE_KEY, provider);
const contractABI = [
  "function updatePrice(uint256 newPrice) external",
  "function getPrice() view returns (uint256)"
];
const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, wallet);

async function displayStatus(livePrice, onChainPrice, thresholdValue) {
  console.clear();
  console.log("CheyneLINK Price Feed Bot");
  console.log(`Token: ${TOKEN_NAME} (${TOKEN_SYMBOL})`);
  console.log(`Price Change Threshold: ±${ethers.utils.formatUnits(THRESHOLD_PERCENT.div(1000), 4)}%`);
  console.log("-------------------------------------------------------------");
  console.log(`Live Price Feed: $${ethers.utils.formatUnits(livePrice, TOKEN_DECIMALS)}`);
  console.log(`On-Chain Price: $${ethers.utils.formatUnits(onChainPrice, TOKEN_DECIMALS)}`);
  console.log(`Threshold Value: ±$${ethers.utils.formatUnits(thresholdValue, TOKEN_DECIMALS)}`);
  console.log(`Total Transactions: ${transactionCount}`);
}

async function fetchTokenPrice() {
  try {
    const url = GECKOTERMINAL_API_URL
      .replace("{network}", "ethereum")
      .replace("{token_address}", TOKEN_ADDRESS);

    const response = await axios.get(url);
    const tokenPrice = response.data?.data?.attributes?.token_prices[TOKEN_ADDRESS.toLowerCase()];

    if (tokenPrice) {
      latestFetchedPrice = ethers.utils.parseUnits(tokenPrice, TOKEN_DECIMALS);
      return latestFetchedPrice;
    } else {
      console.error("Token price not found in response.");
      return null;
    }
  } catch (error) {
    console.error("Error fetching token price from GeckoTerminal API:", error);
    return null;
  }
}

async function fetchOnChainPrice() {
  try {
    return await contract.getPrice();
  } catch (error) {
    console.error("Error fetching on-chain price:", error);
    return null;
  }
}

async function updatePriceOnChain(newPrice, gasPrice = INITIAL_GAS_PRICE) {
  if (!newPrice) {
    console.error("Invalid price provided for on-chain update.");
    return;
  }
  if (isUpdating) return;
  isUpdating = true;

  try {
    const nonce = await provider.getTransactionCount(wallet.address, "latest");
    const txOptions = { nonce, gasLimit: DEFAULT_GAS_LIMIT_HEX, gasPrice };
    const tx = await contract.updatePrice(newPrice, txOptions);
    console.log("\nTransaction sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("Transaction confirmed:", receipt.transactionHash);
    transactionCount++;
  } catch (error) {
    console.error("Error updating on-chain price:", error);
  } finally {
    isUpdating = false;
  }
}

async function checkAndUpdatePrice() {
  const livePrice = await fetchTokenPrice();
  if (!livePrice) {
    console.error("Failed to fetch live price.");
    return;
  }

  const onChainPrice = await fetchOnChainPrice();
  if (!onChainPrice) {
    console.error("Failed to fetch on-chain price.");
    return;
  }

  const priceDifference = livePrice.sub(onChainPrice).abs();
  const thresholdValue = livePrice.mul(THRESHOLD_PERCENT).div(10000000);

  await displayStatus(livePrice, onChainPrice, thresholdValue);

  if (priceDifference.gt(thresholdValue)) {
    console.log("Significant price change detected. Updating on-chain price...");
    await updatePriceOnChain(livePrice);
  }
}

// Main function to initiate bot operations
async function main() {
  console.log("Starting the CheyneLINK Price Feed Bot...");

  await checkAndUpdatePrice();
  await updatePriceOnChain(latestFetchedPrice); // Update on first launch

  setInterval(async () => {
    await checkAndUpdatePrice();

    // Wait 5 seconds after each interval check to update the contract price
    setTimeout(async () => {
      if (latestFetchedPrice) {
        await updatePriceOnChain(latestFetchedPrice);
      }
    }, 5000);
  }, parseInt(CHECK_INTERVAL));
}

main().catch((error) => console.error("Error running bot:", error));
