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
let countdown = parseInt(CHECK_INTERVAL) / 1000;
let latestFetchedPrice = null;
let isUpdating = false;

const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(BOT_PRIVATE_KEY, provider);
const contractABI = [
  "function updatePrice(uint256 newPrice) external",
  "function getPrice() view returns (uint256)"
];
const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, wallet);

async function showHeader() {
  console.clear();
  console.log("CheyneLINK Price Feed Bot");
  console.log(`Token: ${TOKEN_NAME} (${TOKEN_SYMBOL})`);
  console.log(`Price Change Threshold: ±${ethers.utils.formatUnits(THRESHOLD_PERCENT.div(1000), 4)}%`);
  console.log("-------------------------------------------------------------");
}

async function displayBotBalance() {
  try {
    const balance = await provider.getBalance(BOT_WALLET_ADDRESS);
    console.log(`Bot's Wallet Balance: ${ethers.utils.formatEther(balance)} ETH`);
  } catch (error) {
    console.error("Error fetching wallet balance:", error);
  }
}

async function fetchTokenPrice() {
  try {
    const url = GECKOTERMINAL_API_URL.replace("{network}", "ethereum").replace("{token_address}", TOKEN_ADDRESS);
    const response = await axios.get(url);
    const tokenPrice = response.data?.data?.attributes?.token_prices[TOKEN_ADDRESS.toLowerCase()];

    if (tokenPrice) {
      return ethers.utils.parseUnits(tokenPrice, TOKEN_DECIMALS);
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
  showHeader();
  await displayBotBalance();

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

  console.log(`Live Price Feed: $${ethers.utils.formatUnits(livePrice, TOKEN_DECIMALS)}`);
  console.log(`On-Chain Price: $${ethers.utils.formatUnits(onChainPrice, TOKEN_DECIMALS)}`);
  console.log(`Threshold Value: ±$${ethers.utils.formatUnits(thresholdValue, TOKEN_DECIMALS)}`);
  console.log(`Total Transactions: ${transactionCount}`);

  if (priceDifference.gt(thresholdValue)) {
    console.log("Significant price change detected. Updating on-chain price...");
    await new Promise((resolve) => setTimeout(resolve, 5000));
    await updatePriceOnChain(livePrice);
  } else {
    console.log("No significant price change detected; no update needed.");
  }
}

async function main() {
  await checkAndUpdatePrice();

  setInterval(async () => {
    countdown--;
    process.stdout.write(`\rNext check in: ${countdown} seconds`);

    if (countdown <= 0) {
      await checkAndUpdatePrice();
      countdown = parseInt(CHECK_INTERVAL) / 1000;
    }
  }, 1000);
}

main().catch((error) => console.error("Error running bot:", error));
