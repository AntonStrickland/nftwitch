pragma solidity ^0.6.6;

interface NFTwitchFactory_Interface {
    function createRandomNumber(uint256 userProvidedSeed) external returns (bytes32 requestId);
    function getNextNFTId() external view returns (uint256);
}
