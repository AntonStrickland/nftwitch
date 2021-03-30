pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "https://github.com/smartcontractkit/chainlink/evm-contracts/src/v0.4/ChainlinkClient.sol";
import {NFTwitchFactory_Interface} from "../interfaces/NFTwitchFactory_Interface.sol";

/*
 * Network: Rinkeby
 * Chainlink VRF Coordinator address: 0xb3dCcb4Cf7a26f6cf6B120Cf5A73875B7BBc655B
 * LINK token address:                0x01BE23585060835E02B77ef475b0Cc51aA1e0709
 * Key Hash: 0x2ed0feb3e7fd2022120aa84fab1945545a9f2ffc9076fd6156fa96eaff4c1311
 */

contract NFTwitch is ERC721, ChainlinkClient
{
  uint256 internal fee;

  address public factory;
  address internal streamer;

  mapping(bytes32 => string) requestToCharacterName;
  mapping(bytes32 => address) requestToSender;
  mapping(bytes32 => uint256) requestToTokenId;

  modifier onlyFactory()
  {
      require(msg.sender == factory, "Can only be called by the factory");
      _;
  }

  modifier onlyStreamer()
  {
      require(msg.sender == streamer, "Can only be called by the streamer");
      _;
  }

  modifier onlyRNG()
  {
      require(msg.sender == factory.rng_address, "Can only be called by the RNG");
      _;
  }

  event RequestFollowsFulfilled(
    bytes32 indexed requestId,
    uint256 indexed follows
  );

  constructor(streamer) public ERC721("NFTwitch", "NFTW")
  {
    streamer = _streamer;
    factory = msg.sender;
    fee = 0.1 * 10 ** 18; // 0.1 LINK
  }

  function setStreamer(address _streamer) public onlyFactory
  {
    streamer = _streamer;
  }

  function mintMoreNFTs(uint256 userProvidedSeed, string memory name) public returns (bytes32)
  {
    bytes32 requestId = NFTwitchFactory_Interface(factory).createRandomNumber(userProvidedSeed, msg.sender);
    requestToCharacterName[requestId] = name;
    requestToSender[requestId] = msg.sender; // owner of the NFT
    return requestId;
  }


  function requestFollows(address _oracle, string _jobId) public
  {
    uint256 currentID = factory.getIdFromWallet(streamer);
    require(currentID > 0);
    Chainlink.Request memory req = buildChainlinkRequest(stringToBytes32(_jobId), this, this.fulfillFollows.selector);
    req.add("to_id", uintToString(currentID));
    req.add("action", "follows");
    sendChainlinkRequestTo(_oracle, req, ORACLE_PAYMENT);
  }

  function fulfillFollows(bytes32 _requestId, uint256 _follows) public
    recordChainlinkFulfillment(_requestId)
  {
    emit RequestFollowsFulfilled(_requestId, _follows);
    currentLevel = _follows;
  }

  function setTokenURI(uint256 tokenId, string memory _tokenURI) public
  {
    require(
      _isApprovedOrOwner(_msgSender(), tokenId),
      "ERC721: transfer caller is not owner nor approved"
      );
      _setTokenURI(tokenId, _tokenURI);
  }

  function getTokenURI(uint256 tokenId) public view returns (string memory) {
      return tokenURI(tokenId);
  }



}
