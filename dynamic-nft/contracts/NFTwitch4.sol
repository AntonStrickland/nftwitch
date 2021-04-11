// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;

import "../../../openzeppelin/contracts/token/ERC721/ERC721.sol";
import "../../../openzeppelin/contracts/math/SafeMath.sol";
import "@chainlink/contracts/src/v0.6/ChainlinkClient.sol";
import "@chainlink/contracts/src/v0.6/vendor/Ownable.sol";

contract NFTwitch4 is ERC721, ChainlinkClient, Ownable {

  using SafeMath for uint256;

  uint256 internal ORACLE_PAYMENT = 0.1 * 10 ** 18; // 0.1 LINK

  // NOTE: We must store the id instead of the username because
  // if they change their username then nothing will be returned,
  // but the id will remain consistent across changed names.
  mapping(uint256 => address) internal wallets;
  mapping(address => uint256) internal ids;

  mapping(string => address) internal loginToAddressVerified; // prepared for registration

  struct StreamerData
  {
    uint256 level; // current level
    uint256 followCount; // required count for the current level
    uint256 requiredFollowCount; // required count for next level
    uint256 prevFollowCount; // required count for the current level
    uint256 allowedMints; // number of NFTs currently allowed to mint

    // Keep track of the allowed mints per level
    uint256 lastMintedLevel;
    uint256 nftsMintedThisLevel;

    string username;
    string pictureURL;
    string uri;

    string[100] urisByLevel;
  }

  uint256[100] internal levelsToFollowers;

  mapping(uint256 => StreamerData) internal data;

  struct NFT
  {
      uint256 twitchId;
      uint256 followCount;
  }

  // Array of all NFTs across all streamers
  NFT[] internal nfts;

  // Array of indices pointing to NFTs in the main array
  // owned by each individual streamer (based on ID)
  mapping(uint256 => uint256[]) internal tokenIndices;

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
    uint256 numberMinted,
    uint256 allowed
  );

  event PictureFulfilled(
    uint256 indexed id,
    bytes32 indexed url
  );

  mapping(bytes32 => address) internal reqToAddress;
  mapping(bytes32 => string) internal reqToLogin;

  constructor() public ERC721("NFTwitch", "NFTW")
  {
    setPublicChainlinkToken();

    uint256 level = 1;
    uint256 requiredFollowCount = 10;
    uint256 prevFollowCount = 0;

    uint256 diff = 0;

    while (level < 100)
    {
      diff = requiredFollowCount - prevFollowCount;
    	prevFollowCount = requiredFollowCount;

      // Increase the number of new NFTs available to be minted
      levelsToFollowers[level] = requiredFollowCount;

    	// Exponentially increase the required follow count for next level and check for overflow
    	requiredFollowCount = ((requiredFollowCount * 10) + (diff * 12))/10;

    	// Increment the level and check for overflow
    	level += 1;
    }

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
    reqToLogin[requestId] = _login;
  }

  // This function is called upon successful registration.
  // Emits an event that the dapp can use to load the dashboard.
  function fulfillRegistration(bytes32 _requestId, uint256 _id)
    external recordChainlinkFulfillment(_requestId)
  {

    // If this id has already been mapped, unmap the old wallet value
    if (uint256(wallets[_id]) != 0)
    {
        delete ids[wallets[_id]];
    }

    // Update the mappings here
    ids[reqToAddress[_requestId]] = _id;
    wallets[_id] = reqToAddress[_requestId];
    data[_id].username = reqToLogin[_requestId];

    // Initialize starting required follow count
    if (data[_id].requiredFollowCount < 10)
    {
      data[_id].requiredFollowCount = 10;
    }

    // Initialize starting level
    if (data[_id].level < 1)
    {
      data[_id].level = 1;
      data[_id].lastMintedLevel = 1;
      data[_id].uri = "";
    }

    emit RequestUserIDFulfilled(_requestId, _id);

  }

  // This function requests the number of followers for a streamer
  // given the sender's wallet address (must be previously registered)
  function requestFollows(address _oracle, string memory _jobId) external
  {
    require(ids[msg.sender] > 0, "Wallet not registered.");
    require(data[ids[msg.sender]].allowedMints == 0, "Mint your NFTs first!");

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

    uint256 numberOfNewMints = 0;

    // For every X followers gained, allow minting of Y NFTs
    while (data[senderID].followCount > data[senderID].requiredFollowCount
      && data[senderID].level < 99)
    {
      // Increase the number of new NFTs available to be minted
    	numberOfNewMints += (data[senderID].level);

    	// Increment the level and required follows
    	data[senderID].level += 1;
      data[senderID].requiredFollowCount = levelsToFollowers[data[senderID].level];
    }

    // Increase the number of total NFTs this streamer can mint
    data[senderID].allowedMints = data[senderID].allowedMints + numberOfNewMints;

    emit RequestFollowsFulfilled(data[senderID].level, _follows,
      data[senderID].requiredFollowCount, data[senderID].allowedMints);
  }

  function requestPicture(address _oracle, string memory _jobId) external
  {
    require(ids[msg.sender] > 0, "Wallet not registered.");

    Chainlink.Request memory req2 = buildChainlinkRequest(stringToBytes32(_jobId), address(this), this.fulfillPicture.selector);
    req2.add("action", "pic");
    req2.add("login", data[ids[msg.sender]].username);

    // Send the request to the oracle
    bytes32 requestId = sendChainlinkRequestTo(_oracle, req2, ORACLE_PAYMENT);

    // Map the request ID to the address for use in the callback
    reqToAddress[requestId] = msg.sender;
  }

  function fulfillPicture(bytes32 _requestId, bytes32 _url)
    external recordChainlinkFulfillment(_requestId)
  {
    // Get the user ID associated with the calling address
    uint256 senderID = ids[reqToAddress[_requestId]];

    data[senderID].pictureURL = bytes32ToString(_url);

    emit PictureFulfilled(senderID, _url);
  }

  // Returns the current level associated with this address
  function getStreamerData() external view returns (uint256, uint256,
    uint256, uint256, uint256, string memory, string memory)
  {
    uint256 senderID = ids[msg.sender];
    return (data[senderID].level,
      data[senderID].followCount,
      data[senderID].prevFollowCount,
      data[senderID].requiredFollowCount,
      data[senderID].allowedMints,
      data[senderID].username,
      data[senderID].pictureURL);
  }

  // This function is called when the streamer is ready to mint their NFTs
  function mint_nfts(uint256 maxMints) external
  {
    // Check that this address is allowed to mint an NFT
    uint256 senderID = ids[msg.sender];
    require(data[senderID].allowedMints > 0, "Nothing to mint");

    if (maxMints > data[senderID].allowedMints)
    {
      maxMints = data[senderID].allowedMints;
    }

    uint256 nextId = nfts.length;
    uint256 totalMinted = 0;
    while(data[senderID].allowedMints > 0
      && totalMinted < maxMints
      && data[senderID].level > data[senderID].lastMintedLevel)
    {
      // We need to get the nextID based on the total NFTs
      nextId = nfts.length;

      // Decrease the number of available mints
      data[senderID].allowedMints = data[senderID].allowedMints - 1;

      // Create the struct, add to list associated with streamer's ID
      // We want the follow count of that particular milestone
      nfts.push(NFT(senderID, levelsToFollowers[data[senderID].lastMintedLevel]));
      tokenIndices[senderID].push(nextId);

      data[senderID].nftsMintedThisLevel += 1;

      // If we cannot mint any more at this level, go to the next level
      if (data[senderID].nftsMintedThisLevel >= data[senderID].lastMintedLevel)
      {
        data[senderID].nftsMintedThisLevel = 0;
        data[senderID].lastMintedLevel += 1;
      }

      // Associates the address with the new token's id
      _safeMint(msg.sender, nextId);
      totalMinted = totalMinted + 1;
    }

    emit MintFulfilled(msg.sender, nextId, totalMinted, data[senderID].allowedMints);
  }

  // Is the sender registered with the contract?
  function isRegistered() external view returns (bool)
  {
    return (ids[msg.sender] > 0);
  }

  // Is the sender registered with the contract?
  function getIdFromWallet() external view returns (uint256)
  {
    return ids[msg.sender];
  }

  // Get the token indices of all NFTs minted by the login
  function getMyNFTs() external view returns (uint256[] memory)
  {
      return tokenIndices[ids[msg.sender]];
  }

  // Get the data of an NFT given the token ID
  function getTokenData(uint256 tokenId) external view returns (uint256, uint256, uint256)
  {
    return(nfts[tokenId].twitchId, nfts[tokenId].followCount, 0);
  }

  function getUriData(uint256 lvl) external view returns (uint256, uint256)
  {
    require(ids[msg.sender] > 0, "Wallet not registered.");
    uint256 senderID = ids[msg.sender];
    return (senderID, levelsToFollowers[lvl]);
  }

  function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
    address tokenOwner = ERC721.ownerOf(tokenId);
    uint256 senderID = ids[tokenOwner];
    uint256 lvl = data[senderID].level;
    //return data[senderID].urisByLevel[lvl];
    return data[senderID].uri;
  }

  function setURI(string memory _uri) external {
    require(ids[msg.sender] > 0, "Wallet not registered.");
    uint256 senderID = ids[msg.sender];
    data[senderID].uri = _uri;
  }

  function setURIByLevel(string memory _uri, uint256 lvl) external {
    require(ids[msg.sender] > 0, "Wallet not registered.");
    uint256 senderID = ids[msg.sender];
    data[senderID].urisByLevel[lvl] = _uri;
  }

  // Only the one who deployed the contract can withdraw
  function withdrawBalance() external onlyOwner {
    msg.sender.transfer(address(this).balance);
  }

  receive() external payable {}

  function withdrawLink() public onlyOwner {
    LinkTokenInterface link = LinkTokenInterface(chainlinkTokenAddress());
    require(link.transfer(msg.sender, link.balanceOf(address(this))), "Unable to transfer");
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

  function bytes32ToString(bytes32 x) internal pure returns (string memory) {
      bytes memory bytesString = new bytes(32);
      uint charCount = 0;
      for (uint j = 0; j < 32; j++) {
          byte char = byte(bytes32(uint(x) * 2 ** (8 * j)));
          if (char != 0) {
              bytesString[charCount] = char;
              charCount++;
          }
      }
      bytes memory bytesStringTrimmed = new bytes(charCount);
      for (uint256 j = 0; j < charCount; j++) {
          bytesStringTrimmed[j] = bytesString[j];
      }
      return string(bytesStringTrimmed);
  }

}
