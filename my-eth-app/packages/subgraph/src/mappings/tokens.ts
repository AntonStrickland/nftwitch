import { Token } from "../types/schema";

export function addToken(address: string): void {
  let token = Token.load(address);
  if (token != null) {
    return;
  }

  token = new Token(address);
  if (address == "0x5d0D4Cf3Fc56cdf3CC02083C5cE77f73f34331B4") {
    token.decimals = 18;
    token.name = "NFTwitch";
    token.symbol = "NFTW";
  } else {
    token.decimals = 0;
    token.name = null;
    token.symbol = null;
  }

  token.save();
}
