pragma solidity 0.4.24;

import "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";
import "https://github.com/smartcontractkit/chainlink/evm-contracts/src/v0.4/ChainlinkClient.sol";
import "https://github.com/smartcontractkit/chainlink/evm-contracts/src/v0.4/vendor/Ownable.sol";
import {NFTwitchRNG_Interface} from "../interfaces/NFTwitchRNG_Interface.sol";

contract NFTwitchFactory is ChainlinkClient, Ownable {

  uint256 internal ORACLE_PAYMENT = 0.1 * 10 ** 18; // 0.1 LINK
  uint256 public currentID;
  uint256 public currentLevel;
  address public rng_address;

  AggregatorV3Interface internal priceFeed;

  mapping(uint256 => address) public deployedNFTs; // streamer to NFT
  mapping(address => uint256) internal wallets;
  mapping(uint256 => address) internal ids;

  struct NFT
  {
    uint256 strength;
    uint256 speed;
    uint256 stamina;
    string name;
  }

  mapping(address => NFT[]) public nfts;

  // NOTE: We must store the id instead of the username because
  // if they change their username then nothing will be returned,
  // but the id will remain consistent across changed names.

  event RequestUserIDFulfilled(
    bytes32 indexed requestId,
    uint256 indexed userID
  );

  constructor() public Ownable() {
    setPublicChainlinkToken();

    // LINK/ETH Mainnet price, since there is none for Rinkeby
    priceFeed = AggregatorV3Interface(0xDC530D9457755926550b59e8ECcdaE7624181557)
  }

  function getNextNFTId() public view {
    return nfts.length;
  }

  function set_rng_address(address _rng_address) public onlyOwner
  {
        rng_address = _rng_address;
  }

  function createRandomNumber(uint256 userProvidedSeed) public returns (bytes32 requestId)
  {
      require(wallets[msg.sender] != 0, "Only a streamer contract can call this");
      //require(LINK.balanceOf(address(this)) >= fee, "Not enough LINK");
      return NFTwitchRNG_Interface(rng_address).createRandomNumber(userProvidedSeed);
  }


  function createNFTContract(address _VRFCoordinator, address _LinkToken, bytes32 _keyHash, uint256 _id)
  public
  {
      address newNFT = new NFTSimple(_VRFCoordinator, _LinkToken, _keyHash, msg.sender);
      deployedNFTs[_id] = newNFT;

      // fund the contract with enough LINK
      LinkTokenInterface link = LinkTokenInterface(chainlinkTokenAddress());
      link.transfer(newNFT, 1 * getLatestPriceLINK());
  }


  function do_random_stuff(bytes32 requestId, uint256 randomNumber) public onlyRNG
  {
    // define the creation of the NFT
    uint256 newId = NFTwitchFactory_Interface(factory).getNextNFTId();
    uint256 strength = (randomNumber % 100);
    uint256 speed = ((randomNumber % 10000) / 100);
    uint256 stamina = ((randomNumber % 1000000) / 10000);

    nfts.push(
      NFT(
        strength,
        speed,
        stamina,
        requestToCharacterName[requestId]
        )
      );

      // Associates the address with the new token's id
      _safeMint(requestToSender[requestId], newId);
  }


  function requestUserID(address _oracle, string _jobId, string _login) public
  {
    Chainlink.Request memory req = buildChainlinkRequest(stringToBytes32(_jobId), this, this.fulfillUserID.selector);
    req.add("login", _login);
    req.add("sender", toAsciiString(msg.sender));
    req.add("action", "register");
    sendChainlinkRequestTo(_oracle, req, ORACLE_PAYMENT);
  }

  function fulfillUserID(bytes32 _requestId, uint256 _id)
    public
    recordChainlinkFulfillment(_requestId)
  {
    emit RequestUserIDFulfilled(_requestId, _id);
    currentID = _id;

    // If this id has already been mapped, unmap the old wallet value
    if (wallets[_id] != 0x0)
    {
        delete ids[wallets[_id]];
    }

    // Update the mappings here
    ids[sender] = _id;
    wallets[_id] = sender;

    // If the ID does not have an NFT contract, create one now
    if (deployedNFTs[_ids] != 0x0)
    {
      createNFTContract(_id);
    }

  }

  function withdrawLink() public onlyOwner {
    LinkTokenInterface link = LinkTokenInterface(chainlinkTokenAddress());
    require(link.transfer(msg.sender, link.balanceOf(address(this))), "Unable to transfer");
  }

  function cancelRequest(
    bytes32 _requestId,
    uint256 _payment,
    bytes4 _callbackFunctionId,
    uint256 _expiration
  )
    public
    onlyOwner
  {
    cancelChainlinkRequest(_requestId, _payment, _callbackFunctionId, _expiration);
  }

  /**
   * Returns the latest price of LINK
   */
  function getLatestPriceLINK() public view returns (int) {
      (
          uint80 roundID,
          int price,
          uint startedAt,
          uint timeStamp,
          uint80 answeredInRound
      ) = priceFeed.latestRoundData();
      return price;
  }

  function toAsciiString(address x) internal pure returns (string memory) {
    bytes memory s = new bytes(40);
    for (uint i = 0; i < 20; i++) {
        bytes1 b = bytes1(uint8(uint(uint160(x)) / (2**(8*(19 - i)))));
        bytes1 hi = bytes1(uint8(b) / 16);
        bytes1 lo = bytes1(uint8(b) - 16 * uint8(hi));
        s[2*i] = char(hi);
        s[2*i+1] = char(lo);
    }
    return string(s);
  }

  function char(bytes1 b) internal pure returns (bytes1 c) {
    if (uint8(b) < 10) return bytes1(uint8(b) + 0x30);
    else return bytes1(uint8(b) + 0x57);
  }

  function uintToString(uint i) internal pure returns (string){
    if (i == 0) return "0";
    uint j = i;
    uint length;
    while (j != 0){
        length++;
        j /= 10;
    }
    bytes memory bstr = new bytes(length);
    uint k = length - 1;
    while (i != 0){
        bstr[k--] = byte(48 + i % 10);
        i /= 10;
    }
    return string(bstr);
  }

}
