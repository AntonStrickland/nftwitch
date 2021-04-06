// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;

import "../../../openzeppelin/contracts/token/ERC721/ERC721.sol";
import "../../../openzeppelin/contracts/math/SafeMath.sol";
import "@chainlink/contracts/src/v0.6/ChainlinkClient.sol";
import "@chainlink/contracts/src/v0.6/vendor/Ownable.sol";

/*
 * Network: Rinkeby
 * Chainlink VRF Coordinator address: 0xb3dCcb4Cf7a26f6cf6B120Cf5A73875B7BBc655B
 * LINK token address:                0x01BE23585060835E02B77ef475b0Cc51aA1e0709
 * Key Hash: 0x2ed0feb3e7fd2022120aa84fab1945545a9f2ffc9076fd6156fa96eaff4c1311
 */

contract NFTwitch4 is ERC721, ChainlinkClient, Ownable {

  using SafeMath for uint256;

  uint256 internal ORACLE_PAYMENT = 0.1 * 10 ** 18; // 0.1 LINK

  // NOTE: We must store the id instead of the username because
  // if they change their username then nothing will be returned,
  // but the id will remain consistent across changed names.
  mapping(uint256 => address) public wallets;
  mapping(address => uint256) public ids;

  mapping(string => address) public loginToAddressVerified; // prepared for registration

  struct StreamerData
  {
    uint256 level; // current level
    uint256 followCount; // last updated follower count
    uint256 requiredFollowCount; // required count for next level
    uint256 prevFollowCount; // required count for the current level
    uint256 allowedMints; // number of NFTs currently allowed to mint
  }

  mapping(uint256 => StreamerData) public data;

  struct NFT
  {
      uint256 level;
      uint256 view_count;
      uint256 broadcaster_type; // 1 = normal, 2 = affiliate, 3 = partner, etc.
  }

  // Array of all NFTs across all streamers
  NFT[] internal nfts;

  // Array of indices pointing to NFTs in the main array
  // owned by each individual streamer (based on ID)
  mapping(uint256 => uint256[]) public tokenIndices;

  event VerifyStreamer(
    bytes32 indexed requestId,
    bool indexed success
  );

  event RequestUserIDFulfilled(
    bytes32 indexed requestId,
    uint256 indexed userID
  );

  event RequestFollowsFulfilled(
    uint256 indexed level,
    uint256 indexed follows,
    uint256 indexed reqFollows,
    uint256 allowed
  );

  event MintFulfilled(
    address indexed addr,
    uint256 indexed nextId,
    bool indexed success,
    uint256 allowed
  );

  bytes32 public testDesc;
  bytes32 public testAddr;

  mapping(bytes32 => address) public reqToAddress;
  mapping(bytes32 => string) public reqToLogin;

  constructor() public ERC721("NFTwitch", "NFTW") {
    setPublicChainlinkToken();
  }

  // This function is called to verify the streamer prior to registration.
  // Given a username, check that the description contains the sender's address
  function verifyStreamer(address _oracle, string memory _jobId, string memory _login)
    external
  {
    // Request the description based on the login
    Chainlink.Request memory req = buildChainlinkRequest(stringToBytes32(_jobId), address(this), this.fullfillVerification.selector);
    req.add("login", _login);
    req.add("action", "verify");

    // Send the request to the oracle
    bytes32 requestId = sendChainlinkRequestTo(_oracle, req, ORACLE_PAYMENT);

    // Map the request ID to the address and login for use in the callback
    reqToAddress[requestId] = msg.sender;
    reqToLogin[requestId] = _login;
  }

  // Receives the desc and compares it to sender address
  function fullfillVerification(bytes32 _requestId, bytes32 _desc)
    external recordChainlinkFulfillment(_requestId)
  {
    // Get address as bytes32 for comparison
    bytes32 addr = bytes32(uint256(reqToAddress[_requestId]));

    testDesc = _desc;
    testAddr = addr;

    // If the user's description contains the sender's address,
    // then they are successfully verified.
    if (_desc > 0 && addr == _desc)
    {
        // Set the verified address to the calling address
        loginToAddressVerified[reqToLogin[_requestId]] = reqToAddress[_requestId];

        // Emit event to indicate success
        emit VerifyStreamer(_requestId, true);
    }
    else
    {
        // Emit event to indicate failure
        emit VerifyStreamer(_requestId, false);
    }
  }

  // This function is called to register the streamer with the smart contract.
  // We check the Twitch API to verify that this wallet belongs to the streamer.
  function registerStreamer(address _oracle, string memory _jobId, string memory _login)
    external
  {
    require(loginToAddressVerified[_login] == msg.sender, "Verify login");

    // Request the user ID based on the login
    Chainlink.Request memory req = buildChainlinkRequest(stringToBytes32(_jobId), address(this), this.fulfillRegistration.selector);
    req.add("login", _login);
    req.add("action", "register");

    // Reset this to zero to require verification before calling again
    loginToAddressVerified[_login] = address(0);

    // Send the request to the oracle
    bytes32 requestId = sendChainlinkRequestTo(_oracle, req, ORACLE_PAYMENT);

    // Map the request ID to the address for use in the callback
    reqToAddress[requestId] = msg.sender;
  }

  // This function is called upon successful registration.
  // Emits an event that the dapp can use to load the dashboard.
  function fulfillRegistration(bytes32 _requestId, uint256 _id)
    external recordChainlinkFulfillment(_requestId)
  {
    emit RequestUserIDFulfilled(_requestId, _id);

    // If this id has already been mapped, unmap the old wallet value
    if (uint256(wallets[_id]) != 0)
    {
        delete ids[wallets[_id]];
    }

    // Update the mappings here
    ids[reqToAddress[_requestId]] = _id;
    wallets[_id] = reqToAddress[_requestId];

    // Initialize starting required follow count
    if (data[_id].requiredFollowCount < 10)
    {
      data[_id].requiredFollowCount = 10;
    }

    // Initialize starting level
    if (data[_id].level < 1)
    {
      data[_id].level = 1;
    }

  }

  // This function requests the number of followers for a streamer
  // given the sender's wallet address (must be previously registered)
  function requestFollows(address _oracle, string memory _jobId) external
  {
    require(ids[msg.sender] > 0, "Wallet not registered.");

    Chainlink.Request memory req = buildChainlinkRequest(stringToBytes32(_jobId), address(this), this.fulfillFollows.selector);
    req.addUint("to_id", ids[msg.sender]);
    req.add("action", "follows");

    // Send the request to the oracle
    bytes32 requestId = sendChainlinkRequestTo(_oracle, req, ORACLE_PAYMENT);

    // Map the request ID to the address for use in the callback
    reqToAddress[requestId] = msg.sender;
  }

  // This function is called upon retrieval of the follower count
  // We check here if the follower count is above the next amount,
  // the streamer's level increases, allowing them to mint NFTs
  function fulfillFollows(bytes32 _requestId, uint256 _follows)
    external recordChainlinkFulfillment(_requestId)
  {
    // Get the user ID associated with the calling address
    uint256 senderID = ids[reqToAddress[_requestId]];

    // Update the follower count
    data[senderID].followCount = _follows;

    uint256 diff = 0;
    uint256 numberOfNewMints = 0;

    // For every X followers gained, allow minting of Y NFTs
    // (Do this for every level-up)
    while (data[senderID].followCount > data[senderID].requiredFollowCount)
    {
      // Calculations
      diff = data[senderID].requiredFollowCount - data[senderID].prevFollowCount;
    	data[senderID].prevFollowCount = data[senderID].requiredFollowCount;

    	// Exponentially increase the required follow count for next level and check for overflow
    	data[senderID].requiredFollowCount = ((data[senderID].requiredFollowCount * 10) + (diff * 12))/10;
      require(data[senderID].requiredFollowCount > data[senderID].level, "overflow");

    	// Increment the level and check for overflow
    	data[senderID].level = data[senderID].level + 1;

      // Increase the number of new NFTs available to be minted
    	numberOfNewMints = numberOfNewMints + (data[senderID].level - 1);
    }

    // Increase the number of total NFTs this streamer can mint
    data[senderID].allowedMints = data[senderID].allowedMints + numberOfNewMints;

    emit RequestFollowsFulfilled(data[senderID].level, _follows,
      data[senderID].requiredFollowCount, data[senderID].allowedMints);
  }

  // Returns the current level associated with this address
  function getStreamerData() external view returns (uint256, uint256, uint256, uint256)
  {
    uint256 senderID = ids[msg.sender];
    return (data[senderID].level, data[senderID].followCount, data[senderID].requiredFollowCount, data[senderID].allowedMints);
  }

  // This function is called when the streamer is ready to mint their NFTs
  function mint_nft() external
  {
    // Check that this address is allowed to mint an NFT
    uint256 senderID = ids[msg.sender];
    require(data[senderID].allowedMints > 0, "Unable to mint");

    // Calculate the variables to be stored in the NFT

    // We need to get the nextID based on the total NFTs
    // across all streamers, not just the streamer minting the token.
    // So we have a massive array of NFTs spanning all streamers,
    // and a mapping of streamers to an array of indices (which NFTs they own)
    uint256 nextId = nfts.length;

    // TODO: This is not right, as even when we get the data
    // it will only be a reflection of when the NFT was minted,
    // not what was actually true when the follower count increased.
    // Possible fix: Store this data in a struct upon level-up,
    // as a mapping of level (uint256) to the struct.
    uint256 views = 123;
    uint256 b_type = 1;

    // Decrease the number of available mints
    data[senderID].allowedMints = data[senderID].allowedMints - 1;

    // Create the struct, add to list associated with streamer's ID
    nfts.push(NFT(data[senderID].level, views, b_type));
    tokenIndices[senderID].push(nextId);

    // Associates the address with the new token's id
    _safeMint(msg.sender, nextId);

    emit MintFulfilled(msg.sender, nextId, true, data[senderID].allowedMints);
  }

  // Is the sender registered with the contract?
  function isRegistered() external view returns (bool)
  {
    return (ids[msg.sender] > 0);
  }

  // Get the token indices of all NFTs minted by the login
  function getMyNFTs() external view returns (uint256[] memory)
  {
      return tokenIndices[ids[msg.sender]];
  }

  // Get the data of an NFT given the token ID
  function getTokenData(uint256 tokenId) external view returns (uint256, uint256, uint256)
  {
    return(nfts[tokenId].level, nfts[tokenId].view_count, nfts[tokenId].broadcaster_type);
  }

  function withdrawLink() public onlyOwner {
    LinkTokenInterface link = LinkTokenInterface(chainlinkTokenAddress());
    require(link.transfer(msg.sender, link.balanceOf(address(this))), "Unable to transfer");
  }

  function cancelRequest(bytes32 _requestId, uint256 _payment,
    bytes4 _callbackFunctionId, uint256 _expiration
  ) public onlyOwner
  {
    cancelChainlinkRequest(_requestId, _payment, _callbackFunctionId, _expiration);
  }

  function stringToBytes32(string memory source) private pure returns (bytes32 result) {
    bytes memory tempEmptyStringTest = bytes(source);
    if (tempEmptyStringTest.length == 0) {
      return 0x0;
    }

    assembly { // solhint-disable-line no-inline-assembly
      result := mload(add(source, 32))
    }
  }

}
