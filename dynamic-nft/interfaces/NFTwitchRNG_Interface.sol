pragma solidity ^0.6.6;

interface NFTwitchRNG_Interface {
    function createRandomNumber(uint256 userProvidedSeed) external returns (bytes32 requestId);
}
