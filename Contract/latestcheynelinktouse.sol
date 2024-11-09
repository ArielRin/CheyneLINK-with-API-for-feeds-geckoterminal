
/*
How to and Guide find me to ask  (Keep the name scabs)

0x014dafa3E11baC308fd54b3C228421a14daAb7B1 brock
0xA50c2FEB0ad5CF59A053Cfa07d0126723E2D645A



                                                                                                       ....       .
              .:==:.                                                                                   .   ....
           .-=+++++++-:.                                                                               .       ...
       .:=++++++++++++++=:.                                                                           ....
    .-=+++++++++++++++++++++-:                                                                        .   ......
  -+++++++++++-:. .-=++++++++++-                                                                     ..         ...
  =+++++++=:.        .:=++++++++                                                      .--  -=:       ....:-:
  =+++++=.               -++++++  .-=++=-:  -=.                                       .++  --:      ..   :+-.......
  =+++++-                :++++++ .++:..:==. =+::::.   .:::. .::   :: .:.:::.   .:::.  .++  :-. .--:==-.  :+- .---.
  =+++++-                :++++++ -+-        =+=:-++..=+-:=+:.++. :+- -++-:++: -+-:=+: .++  =+: .++-:-++. :+-:++-.
  =+++++-                :++++++ -+=    ::. =+:  ++.:++--=+- :+=.++. -+-  =+-.++---+= .++  =+: .+= . =+: :++++-....
  =+++++-                :++++++ .=+=::-++. =+:  ++..++:.-=.  -+++.  -+-  -+- =+-.-=: .++  =+: .+= . =+: :+=.-+=. .
  =++++++=:.          .:-+++++++   .:---:   :-.  :-. .:---.    ++:   :-.  :-.  :---:  .--  :-. .--.. --..:-:..:--..
  =+++++++++=-.    .:=++++++++++                             =++-                                 ....            .
  .:-+++++++++++--+++++++++++-:.                                                                  .         .......
      .:=++++++++++++++++=-.                                                                     .   .......     .
          :-++++++++++-:.                                                                        ....        ......
             .:=++=-.                                                                           .       .....     .
                 .                                                                              .   ....      ....

*/




// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract CheyneLinkPriceFeed {
    uint256 private currentPrice; // Price stored in 8 decimals, as provided by Chainlink
    uint256 private lastUpdated;
    uint80 private roundId;
    address public owner;

    event PriceUpdated(uint256 newPrice);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), owner);
    }

    // Function to transfer ownership
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner is zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // Function to update the price, restricted to the owner
    function updatePrice(uint256 newPrice) external onlyOwner {
        // Store the price directly in 8 decimals
        currentPrice = newPrice;
        lastUpdated = block.timestamp; // Record the time of the price update
        roundId++; // Increment round ID with each update
        emit PriceUpdated(newPrice);
    }

    // Function to get the current price in 8 decimals
    function getPrice() external view returns (uint256) {
        return currentPrice; // Returns the price in 8 decimals
    }

    // Mimics Chainlink's `latestAnswer`, returning price in 8 decimals
    function latestAnswer() external view returns (uint256) {
        return currentPrice; // Returns the price in 8 decimals
    }

    // Mimics Chainlink's `latestRoundData` structure, with price in 8 decimals
    function latestRoundData()
        external
        view
        returns (
            uint80,    // roundId
            uint256,   // price
            uint256,   // startedAt
            uint256,   // updatedAt
            uint80     // answeredInRound
        )
    {
        return (roundId, currentPrice, lastUpdated, lastUpdated, roundId);
    }

    // Allow the contract to receive ETH
    receive() external payable {}

    // Function to withdraw ETH balance
    function withdrawEth() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }
}
