
pragma solidity 0.6.6;

import "@chainlink/contracts/src/v0.6/VRFConsumerBase.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import {NFTwitch_Interface} from "../interfaces/NFTwitch_Interface.sol";

contract NFTwitchRNG is VRFConsumerBase, Ownable {

    address public vrfCoordinator;
    bytes32 public keyHash;
    uint256 public fee;
    uint256 public randomResult;
    address public factory;

    constructor(bytes32 _keyhash, address _vrfCoordinator, address _linkToken)
        VRFConsumerBase(
            _vrfCoordinator, // VRF Coordinator
            _linkToken  // LINK Token
        ) public
    {
        keyHash = _keyhash;
        fee = 0.1 * 10 ** 18; //_fee; // 0.0001 LINK || 0.1 LINK
        vrfCoordinator = _vrfCoordinator;
    }

    function set_factory_contract(address _factory) public onlyOwner {
        factory = _factory;
    }

    /**
     * Requests randomness from a user-provided seed
     */
    function createRandomNumber(uint256 userProvidedSeed) public returns (bytes32 requestId) {
        require(msg.sender == factory, "Only factory contract can call this");
        require(LINK.balanceOf(address(this)) >= fee, "Not enough LINK");
        return requestRandomness(keyHash, fee, userProvidedSeed);
    }

    /**
     * Callback function used by VRF Coordinator
     */
    function fulfillRandomness(bytes32 requestId, uint256 randomness) internal override {
        require(msg.sender == vrfCoordinator, "Fulillment only permitted by Coordinator");
        randomResult = randomness;
        NFTwitch_Interface(nft_contract).do_random_stuff(requestId, randomness);
    }

    function withdrawLINK(address to, uint256 value) public onlyOwner {
        require(LINK.transfer(to, value), "Not enough LINK");
    }
}
