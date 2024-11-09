

### Step 1: Create the Solidity Contract

1. **Create a New Contract File** (e.g., `PriceFeed.sol`) with the following code:

    ```solidity
    // SPDX-License-Identifier: MIT
    pragma solidity ^0.8.0;

    contract PriceFeed {
        uint256 private currentPrice;
        address private owner;
        mapping(uint256 => bool) private usedNonces;  // Track nonces to prevent replay attacks

        event PriceUpdated(uint256 newPrice);

        modifier onlyOwner() {
            require(msg.sender == owner, "Not authorized");
            _;
        }

        constructor() {
            owner = msg.sender;
        }

        // Standard update function for the owner
        function updatePrice(uint256 newPrice) external onlyOwner {
            currentPrice = newPrice;
            emit PriceUpdated(newPrice);
        }

        // Meta-transaction function
        function metaUpdatePrice(
            uint256 newPrice,
            uint256 nonce,
            bytes memory signature
        ) external {
            require(!usedNonces[nonce], "Nonce already used");  // Prevent replay attacks

            // Recreate the message that was signed off-chain
            bytes32 message = keccak256(abi.encodePacked(newPrice, nonce, address(this)));
            bytes32 messageHash = prefixed(message);

            // Recover the signer address from the signature
            address signer = recoverSigner(messageHash, signature);
            require(signer == owner, "Invalid signature");

            // Mark the nonce as used
            usedNonces[nonce] = true;

            // Update the price
            currentPrice = newPrice;
            emit PriceUpdated(newPrice);
        }

        function getPrice() external view returns (uint256) {
            return currentPrice;
        }

        // Utility function to add the Ethereum prefix to the message hash
        function prefixed(bytes32 hash) internal pure returns (bytes32) {
            return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
        }

        // Recover signer address from a message hash and signature
        function recoverSigner(bytes32 message, bytes memory sig) internal pure returns (address) {
            require(sig.length == 65, "Invalid signature length");

            bytes32 r;
            bytes32 s;
            uint8 v;

            assembly {
                r := mload(add(sig, 32))
                s := mload(add(sig, 64))
                v := byte(0, mload(add(sig, 96)))
            }

            return ecrecover(message, v, r, s);
        }
    }
    ```

    - **Explanation**:
        - `metaUpdatePrice`: This function allows an off-chain signed message to update the price on-chain. It checks the signature and nonce to ensure security and prevent replay attacks.
        - `prefixed`: Adds Ethereum’s message prefix for signature verification.
        - `recoverSigner`: Recovers the signer’s address from the signature.

2. **Compile the Contract**:
    - If using Remix, paste the code there, select Solidity version 0.8.x, and compile.
    - Alternatively, use a local environment like Hardhat or Truffle.

### Step 2: Set Up the Node.js Bot

1. **Initialize a New Node.js Project**:
    ```bash
    mkdir price-feed-bot
    cd price-feed-bot
    npm init -y
    npm install ethers dotenv
    ```

2. **Create a `.env` File**:
    - Store your private key and contract address in `.env` for security:

      ```plaintext
      PRIVATE_KEY=your_private_key_here
      CONTRACT_ADDRESS=your_contract_address_here  # Address after deploying locally
      ```

3. **Write the Bot Script** (`priceFeedBot.js`):

    ```javascript
    require("dotenv").config();
    const { ethers } = require("ethers");

    const contractAddress = process.env.CONTRACT_ADDRESS;
    const privateKey = process.env.PRIVATE_KEY;
    const abi = [
      "function metaUpdatePrice(uint256 newPrice, uint256 nonce, bytes memory signature) external",
    ];

    // Initialize the wallet and provider (use local provider for local testing)
    const provider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545"); // Local provider
    const wallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(contractAddress, abi, wallet);

    // Nonce to ensure each transaction is unique
    let nonce = 1;

    async function signMetaTransaction(newPrice) {
        // Encode the data to match the Solidity side
        const message = ethers.utils.solidityKeccak256(
            ["uint256", "uint256", "address"],
            [newPrice, nonce, contractAddress]
        );

        // Add Ethereum's signed message prefix
        const prefixedMessage = ethers.utils.solidityKeccak256(
            ["string", "bytes32"],
            ["\x19Ethereum Signed Message:\n32", message]
        );

        // Sign the prefixed message
        const signature = await wallet.signMessage(ethers.utils.arrayify(prefixedMessage));

        console.log("Signature:", signature);
        return { signature, nonce };
    }

    async function updatePrice(newPrice) {
        try {
            const { signature, nonce: txNonce } = await signMetaTransaction(newPrice);
            console.log("Signed transaction with nonce:", txNonce);

            // Call metaUpdatePrice on the contract
            const tx = await contract.metaUpdatePrice(newPrice, txNonce, signature);
            await tx.wait();
            console.log("Price updated successfully on-chain!");
            nonce += 1;  // Increment nonce for the next transaction
        } catch (error) {
            console.error("Error updating price:", error);
        }
    }

    // Example usage
    const newPrice = ethers.utils.parseUnits("123.45", 18);  // Example price
    updatePrice(newPrice);
    ```

    - **Explanation**:
        - **signMetaTransaction**: Signs the price update message off-chain, including the `newPrice`, `nonce`, and `contractAddress`.
        - **updatePrice**: Calls the `metaUpdatePrice` function in the contract with the signed message, nonce, and price.

4. **Run the Bot**:
    ```bash
    node priceFeedBot.js
    ```

    - This will sign and submit a meta-transaction to the local instance of your contract.

### Step 3: Test Locally with Hardhat or Ganache

1. **Set Up Local Ethereum Environment**:
   - If using Hardhat:
     ```bash
     npx hardhat node
     ```
   - Or, with Ganache:
     ```bash
     ganache-cli
     ```

2. **Deploy the Contract** to the Local Network:
   - Use Remix or Hardhat to deploy the `PriceFeed.sol` contract to your local network.
   - Once deployed, copy the contract address into your `.env` file as `CONTRACT_ADDRESS`.

3. **Verify the Process**:
   - Run `node priceFeedBot.js` to simulate the bot signing and submitting a meta-transaction.
   - Check the transaction logs in Hardhat or Ganache to verify the transaction executed successfully.
   - Confirm that the `getPrice` function reflects the updated price in the contract.

### Summary

1. **Contract**: The Solidity contract supports meta-transactions through `metaUpdatePrice`, where it verifies a signed message and updates the price.
2. **Bot**: The Node.js bot signs the message off-chain and submits it using the contract owner’s funds.
3. **Testing**: Use a local Ethereum environment like Hardhat or Ganache to test the setup without needing to deploy to a live network.
