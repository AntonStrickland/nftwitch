import React, { useState } from "react";
import { Contract } from "@ethersproject/contracts";
import { getDefaultProvider } from "@ethersproject/providers";
import { useQuery } from "@apollo/react-hooks";
import { ethers } from "ethers"
import { Button, Body, Header, Image, Link } from "./index.js";
import { makeStyles, createMuiTheme } from '@material-ui/core/styles';
import { ThemeProvider } from '@material-ui/styles';
import { TextField } from "@material-ui/core";
import logo from "../ethereumLogo.png";
import WalletButton from "./WalletButton.js";
import { addresses, abis, ropsten } from "@project/contracts";

const useStyles = makeStyles((theme) => ({
  root: {
    '& > *': {
      margin: theme.spacing(1),
      width: '25ch',
    },
  },
}));

const darkTheme = createMuiTheme({
  palette: {
    type: 'dark',
  },
});

class MainComponent extends React.Component {

  constructor(props) {
    super(props);

    this.state = { name: '', hasError: false };

    this.handleChange = this.handleChange.bind(this);
  }

  handleChange(event) {
   this.setState({value: event.target.value});
 }

  testConsole = async (provider, username) => {
    const signer = provider.getSigner();
    const contract = new Contract("0x2db141950A0E8275D7daCB00CB979233AabA5a5A", abis.test, signer);

    const testDesc = await contract.testDesc();
    console.log(testDesc);

    const testAddr = await contract.testAddr();
    console.log(testAddr);
  }


  // 1. Verify that the sender has access to the Twitch account
  // by checking the description for the wallet address
  verifyStreamer = async (provider, username) => {

    // TODO: Add a check that the contract has enough LINK for this call!

    const signer = provider.getSigner();
    console.log(signer);
    const contract = new Contract("0xfc721BD1d76Adf206386CdF5f260da5f220FA05b", abis.test, signer);

    console.log(contract);
    const demo = await contract.verifyStreamer(
      "0xB88369eccCfdaDdC2244CE8eE1073AE876faf64C",
      "9fbe4eed450345fd8218dcc77b585957",
      username
    );

    contract.on('VerifyStreamer', (requestId, success) => {

      console.log("Alert");
      console.log(requestId);
      console.log(success);

      alert('Verification: ' + success.toString());

      // If successfully validated, allow for registration
      if (success)
      {
          // Update state to show the registration button
          console.log("Update the state here!");
      }
    });


  }

  // 2. Register this wallet (if verified) to the streamer
  async registerStreamer(provider, username) {

    const signer = provider.getSigner();
    const contract = new Contract("0xfc721BD1d76Adf206386CdF5f260da5f220FA05b", abis.test, signer);
    const demo = await contract.registerStreamer(
      "0xB88369eccCfdaDdC2244CE8eE1073AE876faf64C",
      "9fbe4eed450345fd8218dcc77b585957",
      username
    );

    contract.on('RequestUserIDFulfilled', function(){this.displayFollowerCount(contract)});

  }

  // 3. If this wallet is registered, check the streamer's follow count
  // to update the number of NFTs the streamer is allowed to mint
  async checkFollowCount(provider) {

    const signer = provider.getSigner();
    const contract = new Contract("0xfc721BD1d76Adf206386CdF5f260da5f220FA05b", abis.test, signer);
    const demo = await contract.requestFollows(
      "0xB88369eccCfdaDdC2244CE8eE1073AE876faf64C",
      "9fbe4eed450345fd8218dcc77b585957"
    );

    contract.on('RequestFollowsFulfilled', function(){this.displayFollowerCount(contract)});

  }

  // 4. If streamer is allowed to mint, then mint new NFTs
  async mint(provider) {

    const signer = provider.getSigner();
    const contract = new Contract("0xfc721BD1d76Adf206386CdF5f260da5f220FA05b", abis.test, signer);
    const demo = await contract.mint_nft();

    contract.on('MintFulfilled', function(){this.displayFollowerCount(contract)});

  }



  async getFollowerCountFromUsername(provider, username) {
    const signer = provider.getSigner();
    console.log(username);
    const contract = new Contract("0xfc721BD1d76Adf206386CdF5f260da5f220FA05b", abis.test, signer);
    console.log(contract);
    const demo = await contract.demo(
      "0xB88369eccCfdaDdC2244CE8eE1073AE876faf64C",
      "9fbe4eed450345fd8218dcc77b585957",
      username
    );

    contract.on('DemoFulfilled', function(){this.displayFollowerCount(contract)});
  }

  async displayFollowerCount(contract) {
    console.log('Demo fulfilled!');
    const followerCount = await contract.followerCount();
    console.log(followerCount);
    alert(followerCount);
  }


    render(props) {

      if (!this.state.provider) {
        return (
          <div>
          <p>
            Connect a wallet to get started.
          </p>
          </div>
        );
      }

      return (
        <div>
        <ThemeProvider theme={darkTheme}>
          <Header>
            <WalletButton provider={this.state.provider}
            loadWeb3Modal={this.state.loadWeb3Modal}
            logoutOfWeb3Modal={this.state.logoutOfWeb3Modal} />
          </Header>
          <Body>
            <Image src={logo} alt="react-logo" />
            <div>
              <form className={props.classes.root} noValidate autoComplete="off">
                <TextField onChange={this.handleChange} id="nameField" label="Enter your Twitch username" />
              </form>
              <Button onClick={this.getFollowerCountFromUsername(props.provider, this.state.name)}>
                Get follower count</Button>

                <Button onClick={this.verifyStreamer(props.provider, this.state.name)}>
                 Verify ownership</Button>

                 <Button onClick={this.testConsole(props.provider, this.state.name)}>
                  testConsole</Button>
            </div>
          </Body>
          </ThemeProvider>
        </div>
      );
    }

}

export default MainComponent;
