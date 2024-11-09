
/*
How to and Guide find me to ask  (Keep the name scabs)





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
    uint256 private currentPrice;
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
        currentPrice = newPrice;
        lastUpdated = block.timestamp; // Record the time of the price update
        roundId++; // Increment round ID with each update
        emit PriceUpdated(newPrice);
    }

    // Function to get the current price
    function getPrice() external view returns (uint256) {
        return currentPrice;
    }

    // Mimics Chainlink's `latestAnswer`
    function latestAnswer() external view returns (uint256) {
        return currentPrice;
    }

    // Mimics Chainlink's `latestRoundData` structure
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
