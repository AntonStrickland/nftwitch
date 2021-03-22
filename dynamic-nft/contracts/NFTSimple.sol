pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@chainlink/contracts/src/v0.6/VRFConsumerBase.sol";

/*
 * Network: Rinkeby
 * Chainlink VRF Coordinator address: 0xb3dCcb4Cf7a26f6cf6B120Cf5A73875B7BBc655B
 * LINK token address:                0x01BE23585060835E02B77ef475b0Cc51aA1e0709
 * Key Hash: 0x2ed0feb3e7fd2022120aa84fab1945545a9f2ffc9076fd6156fa96eaff4c1311
 */

contract NFTSimple is ERC721, VRFConsumerBase {

  bytes32 public keyHash;
  address public vrfCoordinator;
  uint256 internal fee;

  uint256 public randomResult;

  struct Character {
    uint256 strength;
    uint256 speed;
    uint256 stamina;
    string name;
  }

  Character[] public characters;

  mapping(bytes32 => string) requestToCharacterName;
  mapping(bytes32 => address) requestToSender;
  mapping(bytes32 => uint256) requestToTokenId;

  constructor(address _VRFCoordinator, address _LinkToken, bytes32 _keyHash) public
  VRFConsumerBase(_VRFCoordinator, _LinkToken)
  ERC721("NFTSimple", "NFTS") {

    vrfCoordinator = _VRFCoordinator;
    keyHash = _keyHash;
    fee = 0.1 * 10 ** 18; // 0.1 LINK

  }

  function requestNewRandomCharacter(uint256 userProvidedSeed, string memory name) public returns (bytes32) {
    bytes32 requestId = requestRandomness(keyHash, fee, userProvidedSeed);
    requestToCharacterName[requestId] = name;
    requestToSender[requestId] = msg.sender; // owner of the NFT
    return requestId;
  }

  function fulfillRandomness(bytes32 requestId, uint256 randomNumber) internal override {
    // define the creation of the NFT
    uint256 newId = characters.length;
    uint256 strength = (randomNumber % 100);
    uint256 speed = ((randomNumber % 10000) / 100);
    uint256 stamina = ((randomNumber % 1000000) / 10000);

    characters.push(
      Character(
        strength,
        speed,
        stamina,
        requestToCharacterName[requestId]
        )
      );

      _safeMint(requestToSender[requestId], newId);
  }

  function setTokenURI(uint256 tokenId, string memory _tokenURI) public {
    require(
      _isApprovedOrOwner(_msgSender(), tokenId),
      "ERC721: transfer caller is not owner nor approved"
      );
      _setTokenURI(tokenId, _tokenURI);
  }



}
