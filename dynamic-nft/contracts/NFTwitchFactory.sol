pragma solidity 0.4.24;

import "https://github.com/smartcontractkit/chainlink/evm-contracts/src/v0.4/ChainlinkClient.sol";
import "https://github.com/smartcontractkit/chainlink/evm-contracts/src/v0.4/vendor/Ownable.sol";

contract NFTwitchFactory is ChainlinkClient, Ownable {

  uint256 internal ORACLE_PAYMENT = 0.1 * 10 ** 18; // 0.1 LINK
  uint256 public currentID;
  uint256 public currentLevel;

  event RequestUserIDFulfilled(
    bytes32 indexed requestId,
    uint256 indexed userID
  );

  constructor() public Ownable() {
    setPublicChainlinkToken();
  }

  function requestUserID(address _oracle, string _jobId, string _login)
    public
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
  }

  function requestFollows(address _oracle, string _jobId)
    public
  {
    require(currentID > 0);
    Chainlink.Request memory req = buildChainlinkRequest(stringToBytes32(_jobId), this, this.fulfillFollows.selector);
    req.add("to_id", uintToString(currentID));
    req.add("action", "follows");
    sendChainlinkRequestTo(_oracle, req, ORACLE_PAYMENT);
  }

  function fulfillFollows(bytes32 _requestId, uint256 _follows)
    public
    recordChainlinkFulfillment(_requestId)
  {
    emit RequestUserIDFulfilled(_requestId, _follows);
    currentLevel = _follows;
  }

  function getChainlinkToken() public view returns (address) {
    return chainlinkTokenAddress();
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

  function stringToBytes32(string memory source) private pure returns (bytes32 result) {
    bytes memory tempEmptyStringTest = bytes(source);
    if (tempEmptyStringTest.length == 0) {
      return 0x0;
    }

    assembly { // solhint-disable-line no-inline-assembly
      result := mload(add(source, 32))
    }
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
