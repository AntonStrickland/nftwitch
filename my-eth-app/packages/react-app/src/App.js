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

  const [test, setTest] = useState(" ");

  const [state, setState] = useState("init");
  const [followers, setFollowers] = useState(0);

 const [constructorHasRun, setConstructorHasRun] = useState(false);

  const constructor = async (provider, caddr) => {

    if (constructorHasRun) return;
    setConstructorHasRun(true);

    const signer = provider.getSigner();
    const contract = new Contract(caddr, abis.test, signer);
    const registered = await contract.isRegistered();

    if (registered)
    {
      console.log("Registered!");

      await getData(provider, caddr);

      setState("registered");
    }
    else {
      console.log("Not registered");
      setState("new");
    }

  };

  if (props.provider)
  {
    constructor(props.provider, props.caddr)
  }



  const handleInput = event => {
   setName(event.target.value);
 };

  const testConsole = async (provider, caddr, username, test) => {
   const signer = provider.getSigner();
   const contract = new Contract(caddr, abis.test, signer);

   const testDesc = await contract.testDesc();
   console.log(testDesc);

   const testAddr = await contract.testAddr();
   console.log(testAddr);

   setTest(test + "x");
   console.log(test);

   const registered = await contract.isRegistered();

   if (registered)
   {
     console.log("Registered!");
     setState("registered");
   }
   else {
     console.log("Not registered");
   }
 };

 const getData = async (provider, caddr) => {
  const signer = provider.getSigner();
  const contract = new Contract(caddr, abis.test, signer);

  const [level, follow, reqFollow, allowed] = await contract.getStreamerData();
  console.log("Level: " + level.toString());
  console.log("Follow: " + follow.toString());
  console.log("ReqFol: " + reqFollow.toString());
  console.log("Allow:" + allowed.toString());;

  setFollowers(follow.toString());
};


 // 1. Verify that the sender has access to the Twitch account
 // by checking the description for the wallet address
 const verifyStreamer = async (provider, caddr, username) => {

   // TODO: Add a check that the contract has enough LINK for this call!

   const signer = provider.getSigner();
   console.log(signer);
   const contract = new Contract(caddr, abis.test, signer);

   console.log(contract);
   const demo = await contract.verifyStreamer(
     "0xB88369eccCfdaDdC2244CE8eE1073AE876faf64C",
     "9fbe4eed450345fd8218dcc77b585957",
     username
   );

   setState("waiting");

   contract.on('VerifyStreamer', (requestId, success) => {

     // If successfully validated, allow for registration
     if (success)
     {
         // Update state to show the registration button
         setState("verified");
     }
     else {
       setState("new");
     }
   });


 }

 // 2. Register this wallet (if verified) to the streamer
 const registerStreamer = async (provider, caddr, username) => {

   const signer = provider.getSigner();
   const contract = new Contract(caddr, abis.test, signer);
   const demo = await contract.registerStreamer(
     "0xB88369eccCfdaDdC2244CE8eE1073AE876faf64C",
     "9fbe4eed450345fd8218dcc77b585957",
     username
   );

   setState("waiting");

   contract.on('RequestUserIDFulfilled', (requestId, userId) => {
     console.log("Update the state here!");
     setState("registered");
   });

 }

 // 3. If this wallet is registered, check the streamer's follow count
 // to update the number of NFTs the streamer is allowed to mint
 const checkFollowCount = async (provider, caddr) => {

   const signer = provider.getSigner();
   const contract = new Contract(caddr, abis.test, signer);
   const demo = await contract.requestFollows(
     "0xB88369eccCfdaDdC2244CE8eE1073AE876faf64C",
     "9fbe4eed450345fd8218dcc77b585957"
   );

   setState("waiting");

   contract.on('RequestFollowsFulfilled', (requestId, follows) => {
     console.log(follows);
     setFollowers(follows.toString());
     setState("registered");
   });
 }

 // 4. If streamer is allowed to mint, then mint new NFTs
 const mintNFTs = async (provider, caddr) => {

   const signer = provider.getSigner();
   const contract = new Contract(caddr, abis.test, signer);
   const demo = await contract.mint_nft();

   setState("waiting");

   contract.on('MintFulfilled', (addr, nextId, success) => {
     console.log("Next ID: " + nextId.toString());
     console.log("Success: " + success.toString());
     setState("registered");
   });
 }

 const getFollowerCountFromUsername = async (provider, caddr, username) => {
   const signer = provider.getSigner();
   console.log(username);
   const contract = new Contract(caddr, abis.test, signer);
   console.log(contract);
   const demo = await contract.demo(
     "0xB88369eccCfdaDdC2244CE8eE1073AE876faf64C",
     "9fbe4eed450345fd8218dcc77b585957",
     username
   );

   contract.on('DemoFulfilled', function(){displayFollowerCount(contract)});
 }

 const displayFollowerCount = async (contract) => {
   console.log('Demo fulfilled!');
   const followerCount = await contract.followerCount();
   console.log(followerCount);
   alert(followerCount);
 }


  if (!props.provider) {
    return (
      <div>
      <p>
        Connect a wallet to get started.
      </p>
      </div>
    );
  }

  if (state == "waiting")
  {
    return (
      <div>
        <p>Please wait...</p>
      </div>
    );
  }
  if (state == "registered")
  {
    return (
      <div>

      <p>Current followers: {followers}</p>

        <Button onClick={() => checkFollowCount(props.provider, props.caddr)}>
         Check Follow Count</Button>

         <Button onClick={() => mintNFTs(props.provider, props.caddr)}>
          Mint NFTs</Button>

         <Button onClick={() => getData(props.provider, props.caddr)}>
          testData</Button>
      </div>
    );
  }
  else if (state == "verified")
  {
    return (
      <div>
        <form className={classes.root} noValidate autoComplete="off">
          <TextField onChange={handleInput} id="nameField" label="Enter your Twitch username" />
        </form>
        <Button onClick={() => registerStreamer(props.provider, props.caddr, name)}>
         Register</Button>

         <Button onClick={() => testConsole(props.provider, props.caddr, name, test)}>
          testConsole</Button>
      </div>
    );
  }
  else if (state == "new")
  {
    return (
      <div>
        <form className={classes.root} noValidate autoComplete="off">
          <TextField onChange={handleInput} id="nameField" label="Enter your Twitch username" />
        </form>
        <Button onClick={() => getFollowerCountFromUsername(props.provider, props.caddr, name)}>
          Get follower count</Button>

        <Button onClick={() => verifyStreamer(props.provider, props.caddr, name)}>
         Verify ownership</Button>

         <Button onClick={() => testConsole(props.provider, props.caddr, name, test)}>
          testConsole</Button>

      </div>
    );
  }
  else {
    return (<div></div>);
  }


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

        <RenderPage provider={provider} caddr="0x94D0b248D11a509E0F076d04C4FDfD90061BA6Ad" />

      </Body>
      </ThemeProvider>
    </div>
  );
}

export default App;
