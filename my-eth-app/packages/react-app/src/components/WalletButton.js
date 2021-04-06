import React, { useState } from "react";
import { Button } from "./index.js";

class WalletButton extends React.Component {

  render() {
    return (
      <Button
        onClick={() => {
          if (!this.props.provider) {
            this.props.loadWeb3Modal();
          } else {
            this.props.logoutOfWeb3Modal();
          }
        }}
      >
        {!this.props.provider ? "Connect Wallet" : "Disconnect Wallet"}
      </Button>
    );
  }
}

export default WalletButton;
