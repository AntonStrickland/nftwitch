import React, { useState } from "react";
import { Contract } from "@ethersproject/contracts";
import { getDefaultProvider } from "@ethersproject/providers";
import { useQuery } from "@apollo/react-hooks";
import { ethers } from "ethers"
import { Button, Body, Header, Image, Link } from "./components";
import { makeStyles, createMuiTheme } from '@material-ui/core/styles';
import { ThemeProvider } from '@material-ui/styles';
import { TextField } from "@material-ui/core";
import logo from "./ethereumLogo.png";
import useWeb3Modal from "./hooks/useWeb3Modal";

import { addresses, abis, ropsten } from "@project/contracts";
import GET_TRANSFERS from "./graphql/subgraph";

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

async function pairWallet(provider, username) {
  const signer = provider.getSigner();
  console.log(username);
  const contract = new Contract("0x9b2b4735Ac8a110b8Bd976C029091d0d2e4D3EC2", abis.test, signer);
  console.log(contract);
  const requestUserID = await contract.requestUserID(
    "0xB88369eccCfdaDdC2244CE8eE1073AE876faf64C",
    "9fbe4eed450345fd8218dcc77b585957",
    username
  );
  console.log(requestUserID);
  const userID = await contract.currentID();
  console.log(userID);
  alert(userID);
}

async function readOnChainData(provider, address) {

  if (provider)
  {
    const signer = provider.getSigner()
    console.log(provider);
    console.log(provider.network.name);
    const contract = new Contract(address, abis.erc20, provider);
    console.log(contract);
    const tokenBalance = await contract.balanceOf(signer.getAddress());
    alert(tokenBalance)
  }
}

async function getPrice(provider) {
  const signer = provider.getSigner()
  const contract = new Contract("0xf6C6285A662fAE9E17D56Fc504e6AfC56a10E313", abis.feed, provider);
  const price = await contract.getLatestPrice();
  alert(price);
}

function WalletButton({ provider, loadWeb3Modal, logoutOfWeb3Modal }) {
  return (
    <Button
      onClick={() => {
        if (!provider) {
          loadWeb3Modal();
        } else {
          logoutOfWeb3Modal();
        }
      }}
    >
      {!provider ? "Connect Wallet" : "Disconnect Wallet"}
    </Button>
  );
}

function RenderPage(props) {

  const [name, setName] = useState(" ");
  const classes = useStyles();

  const handleInput = event => {
   setName(event.target.value);
 };

  if (!props.provider) {
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
      <form className={classes.root} noValidate autoComplete="off">
        <TextField onChange={handleInput} id="nameField" label="Enter your Twitch username" />
      </form>
      <Button onClick={() => pairWallet(props.provider, name)}>
        Pair wallet with account</Button>
    </div>
  );
}

function Balances(props) {
  if (!props.provider) {
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
      <Button onClick={() => readOnChainData(props.provider,
        props.provider.network.name == "homestead" ? addresses.kovan_link : addresses.kovan_link)}>
        Read LINK Balance
      </Button>

      <Button onClick={() => readOnChainData(props.provider,
        props.provider.network.name == "homestead" ? addresses.kovan_usdc : addresses.kovan_usdc)}>
        Read USDC Balance
      </Button>

      <Button onClick={() => getPrice(props.provider)}>
        Get ETH-USD Price
      </Button>
    </div>
  );
}

function App() {
  const { loading, error, data } = useQuery(GET_TRANSFERS);
  const [provider, loadWeb3Modal, logoutOfWeb3Modal] = useWeb3Modal();

  React.useEffect(() => {
    if (!loading && !error && data && data.transfers) {
      console.log({ transfers: data.transfers });
    }
  }, [loading, error, data]);

  return (
    <div>
    <ThemeProvider theme={darkTheme}>
      <Header>
        <WalletButton provider={provider} loadWeb3Modal={loadWeb3Modal} logoutOfWeb3Modal={logoutOfWeb3Modal} />
      </Header>
      <Body>
        <Image src={logo} alt="react-logo" />

        <RenderPage provider={provider} />

      </Body>
      </ThemeProvider>
    </div>
  );
}

export default App;
