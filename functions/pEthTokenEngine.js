// Import necessary modules
require("dotenv").config();
const ethers = require("ethers");
const WebSocket = require("ws");

// Load environment variables
const {
  RPC_URL,
  BOT_PRIVATE_KEY,
  CONTRACT_ADDRESS,
  BOT_WALLET_ADDRESS,
  TOKEN_NAME,
  TOKEN_SYMBOL,
  PRICE_CHANGE_THRESHOLD,
  DEFAULT_GAS_LIMIT,
  MAX_FEE_PER_GAS_GWEI,
  WEBSOCKET_URL
} = process.env;

// Parse specific environment variables
const parsedThreshold = parseFloat(PRICE_CHANGE_THRESHOLD) / 100000;
const initialGasLimit = ethers.utils.hexlify(parseInt(DEFAULT_GAS_LIMIT, 10));
const initialGasPrice = ethers.utils.parseUnits(MAX_FEE_PER_GAS_GWEI, "gwei");
const gasPriceIncrement = ethers.utils.parseUnits("1", "gwei");

// Set up provider, wallet, and contract
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(BOT_PRIVATE_KEY, provider);
const abi = [
  "function updatePrice(uint256 newPrice) external",
  "function getPrice() view returns (uint256)",
  "function transferOwnership(address newOwner) external",
  "function owner() view returns (address)"
];
const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, wallet);

let sessionTransactionCount = 0;
let isUpdating = false;

// Display header with token and threshold information
function showHeader() {
  console.clear();
  console.log("CheyneLINK Price Feed Bot\n");
  console.log(`Token: ${TOKEN_NAME} (${TOKEN_SYMBOL})`);
  console.log(`Threshold: ±${(parsedThreshold * 100).toFixed(2)}%`);
  console.log("-------------------------------------------------------------");
}

// Display the bot's wallet balance
async function displayBotBalance() {
  try {
    const balance = await provider.getBalance(BOT_WALLET_ADDRESS);
    const formattedBalance = ethers.utils.formatEther(balance);
    console.log(`Bot's wallet balance: ${formattedBalance} ETH`);
  } catch (error) {
    console.error("Error fetching bot wallet balance:", error);
  }
}

// Update the price on-chain with retry logic for handling errors
async function updatePriceOnChain(newPrice, retryGasPrice = initialGasPrice) {
  if (isUpdating) {
    console.log("Update already in progress. Skipping this update attempt.");
    return;
  }

  isUpdating = true;
  try {
    const latestNonce = await provider.getTransactionCount(wallet.address, "latest");

    const txOptions = {
      nonce: latestNonce,
      gasLimit: initialGasLimit,
      gasPrice: retryGasPrice,
    };

    const tx = await contract.updatePrice(newPrice, txOptions);
    console.log("Transaction sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("Transaction confirmed:", receipt.transactionHash);

    sessionTransactionCount++;
  } catch (error) {
    handleTransactionError(error, newPrice, retryGasPrice);
  } finally {
    isUpdating = false;
  }
}

// Error handler for transaction errors
async function handleTransactionError(error, newPrice, retryGasPrice) {
  if (error.code === 'REPLACEMENT_UNDERPRICED') {
    console.log("Replacement transaction underpriced. Retrying with higher gas price...");
    const increasedGasPrice = retryGasPrice.add(gasPriceIncrement);
    await updatePriceOnChain(newPrice, increasedGasPrice);
  } else if (error.code === 'NONCE_EXPIRED') {
    console.log("Nonce expired. Retrying with latest nonce...");
    await updatePriceOnChain(newPrice, retryGasPrice);
  } else if (error.code === 'UNSUPPORTED_OPERATION') {
    console.log("Unsupported operation for gas data. Retrying with simple gas price...");
    await updatePriceOnChain(newPrice, ethers.utils.parseUnits("20", "gwei")); // Fallback gas price
  } else {
    console.error("Error updating price on-chain:", error);
  }
}

// Connect to WebSocket and listen for price updates
function connectToWebSocket() {
  const ws = new WebSocket(WEBSOCKET_URL);

  ws.on("open", () => {
    console.log("Connected to WebSocket for real-time ETH price.");
  });

  ws.on("message", async (data) => {
    const jsonData = JSON.parse(data);
    const livePrice = parseFloat(jsonData.p);

    // Convert live price to 8 decimals
    const newPrice = ethers.utils.parseUnits(livePrice.toFixed(8), 8);

    try {
      const onChainPrice = await contract.getPrice();
      const priceDifference = newPrice.sub(onChainPrice).abs();
      const thresholdDollarValue = livePrice * parsedThreshold;

      showHeader();
      console.log(`Live Price Feed: $${livePrice}`);
      console.log(`On-Chain Price: $${ethers.utils.formatUnits(onChainPrice, 8)}`);
      console.log(`Threshold Dollar Value: ±$${thresholdDollarValue.toFixed(2)}`);
      console.log(`Session Transactions: ${sessionTransactionCount}`);

      if (priceDifference.gt(ethers.utils.parseUnits(thresholdDollarValue.toFixed(8), 8))) {
        console.log("Price change significant, updating...");
        await updatePriceOnChain(newPrice);
      } else {
        console.log("Price change not significant, no update needed.");
      }
    } catch (error) {
      console.error("Error during price comparison or update:", error);
    }
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });

  ws.on("close", () => {
    console.log("WebSocket connection closed. Reconnecting...");
    setTimeout(connectToWebSocket, 1000);
  });
}

// Main function to start the bot
async function main() {
  showHeader();
  await displayBotBalance();
  connectToWebSocket();
}

main().catch(error => console.error("Error in main execution:", error));
