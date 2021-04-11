import React, { useState } from "react";
import { Contract } from "@ethersproject/contracts";
import { getDefaultProvider } from "@ethersproject/providers";
import { useQuery } from "@apollo/react-hooks";
import { ethers } from "ethers"
import { Body, Header, Image, Link, Footer } from "./components";
import { makeStyles, createMuiTheme } from '@material-ui/core/styles';
import { ThemeProvider } from '@material-ui/styles';
import { Button, TextField, Container } from "@material-ui/core";
import logo from "./ethereumLogo.png";
import useWeb3Modal from "./hooks/useWeb3Modal";

import { addresses, abis, ropsten } from "@project/contracts";
import GET_TRANSFERS from "./graphql/subgraph";

import axios from 'axios';

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
    <Button variant="outlined"
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
  const [previousState, setPreviousState] = useState("");

  const [level, setLevel] = useState(0);
  const [followers, setFollowers] = useState(0);
  const [toThisLevel, setToThisLevel] = useState(0);
  const [toNextLevel, setToNextLevel] = useState(0);
  const [allowed, setAllowed] = useState(0);
  const [numberToMint, setNumberToMint] = useState(0);

  const [waitMessage, setWaitMessage] = useState("");

 const [constructorHasRun, setConstructorHasRun] = useState(false);
 const [gotTwitchInfo, setGotTwitchInfo] = useState(false);

  const [username, setUsername] = useState("");
  const [profileURL, setProfileURL] = useState("x");

  const constructor = async (provider, caddr) => {

    if (constructorHasRun) return;
    setConstructorHasRun(true);

    const signer = provider.getSigner();
    const contract = new Contract(caddr, abis.test, signer);
    const registered = await contract.isRegistered();

    if (registered)
    {
      //console.log("Registered!");

      await getData(provider, caddr);
    }
    else {
      //console.log("Not registered");
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

 const handleInputMint = (allowed, event) => {

   if (parseInt(event.target.value) <= allowed)
   {
       setNumberToMint(event.target.value);
   }
};


 const getData = async (provider, caddr) => {

  const signer = provider.getSigner();
  const contract = new Contract(caddr, abis.test, signer);

  const [level, follow, lastFollow, reqFollow, allowed, uname, pic] = await contract.getStreamerData();

  // We must break the URL apart in the external adapter
  // and then put it back together here
  // because of the 32 bytes limitation
  const pic1 = pic.toString().substr(0, 8) + "-";
  const pic2 = pic.toString().substr(8, 4) + "-";
  const pic3 = pic.toString().substr(12, 4) + "-";
  const pic4 = pic.toString().substr(16, 4) + "-";
  const pic5 = pic.toString().substr(20, 12);

  const picFinal = pic1 + pic2 + pic3 + pic4 + pic5;
  const image = 'https://static-cdn.jtvnw.net/jtv_user_pictures/' + picFinal + '-profile_image-300x300.jpg';

  setLevel(level.toString());
  setFollowers(follow.toString());
  setToThisLevel(lastFollow.toString());
  setToNextLevel(reqFollow.toString());
  setAllowed(allowed.toString());
  setUsername(uname.toString());

  if (pic != "")
  {
      setProfileURL(image.toString());
  }


  setState("registered");
};

// 2. Register this wallet (if verified) to the streamer
const withdrawLink = async (provider, caddr, username) => {

  const signer = provider.getSigner();
  const contract = new Contract(caddr, abis.test, signer);
  const demo = await contract.withdrawLink();
}

 // 1. Verify that the sender has access to the Twitch account
 // by checking the description for the wallet address
 const verifyStreamer = async (provider, caddr, username) => {

   // TODO: Add a check that the contract has enough LINK for this call!

   const signer = provider.getSigner();
   //console.log(signer);
   const contract = new Contract(caddr, abis.test, signer);

   //console.log(contract);
   const demo = await contract.verifyStreamer(
     "0xa333365f5cCd13a7ee33FaccDE25eb629cA89DdF",
     "e518420de0ad4b06a2da4278f787d33b",
     username
   );

   setState("waiting");
   setWaitMessage("Checking that your bio matches your address...");

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
     "0xa333365f5cCd13a7ee33FaccDE25eb629cA89DdF",
     "e518420de0ad4b06a2da4278f787d33b",
     username
   );

   setState("waiting");
   setWaitMessage("Linking your wallet with " + username + " ...");

   contract.on('RequestUserIDFulfilled', (requestId, userId) => {
     setState("update");
   });

 }

 // 3. If this wallet is registered, check the streamer's follow count
 // to update the number of NFTs the streamer is allowed to mint
 const checkFollowCount = async (provider, caddr) => {

   const signer = provider.getSigner();
   const contract = new Contract(caddr, abis.test, signer);
   const demo = await contract.requestFollows(
     "0xa333365f5cCd13a7ee33FaccDE25eb629cA89DdF",
     "e518420de0ad4b06a2da4278f787d33b"
   );

   setState("waiting");
   setWaitMessage("Checking if you've reached a new milestone...");

   contract.on('RequestFollowsFulfilled', (requestId, follows, reqfollows, allowed) => {
     console.log(follows);
     setFollowers(follows.toString());
     setAllowed(allowed.toString());
     setNumberToMint(allowed.toString());

     if (allowed > 0)
     {
       setState("levelup");
     }
     else {
       setState("registered");
     }

   });
 }

 // 4. If streamer is allowed to mint, then mint new NFTs
 const mintNFTs = async (provider, caddr, numberToMint) => {

   const signer = provider.getSigner();
   const contract = new Contract(caddr, abis.test, signer);
   const demo = await contract.mint_nfts(parseInt(numberToMint));

   setState("waiting");
   setWaitMessage("Minting your NFTs...");

   contract.on('MintFulfilled', async (addr, nextId, success) => {

     //console.log("Next ID: " + nextId.toString());
     //console.log("Success: " + success.toString());
     setState("update");
   });
 }


 const setPicture = async (provider, caddr) => {

   const signer = provider.getSigner();
   const contract = new Contract(caddr, abis.test, signer);
   const demo = await contract.requestPicture(
     "0xa333365f5cCd13a7ee33FaccDE25eb629cA89DdF",
     "2d1bd9328c56495c8a0ab9c249564cd0"
   );

   setState("waiting");
   setWaitMessage("Syncing picture...");

   contract.on('PictureFulfilled', (requestId, url) => {
     //console.log(url);
     //console.log(url.toString());
     setProfileURL(url.toString());

    setState("registered");

   });
 }

 const setURI = async(provider, caddr) => {

   const signer = provider.getSigner();
   const contract = new Contract(caddr, abis.test, signer);

   setState("waiting");
   setWaitMessage("Updating token URI...");

   //for(var lvl = 1; lvl < 100; lvl++)
   //{
     const jsonData = await createJsonData(level, contract);
     const pinnedURI = await pinJSONToIPFS(process.env.REACT_APP_PINATA_KEY,
       process.env.REACT_APP_PINATA_SECRET, jsonData, contract, level);
   //}

    setState("update");
 }

 const createJsonData = async (lvl, contract) => {

   const metadataTemplate =
   {
     "name": "Streamer Name",
     "description": "NFTwitch allows Twitch streamers to mint dynamic NFTs as they grow their channels. Every X followers, the streamer is allowed to mint Y NFTs that they can then re-sell to their fans directly or on open marketplaces. Both parties have something to gain: the funds can be used as a source of income to help bootstrap a streamer, and fans can hold onto a rare and unique, one-of-a-kind collectible. Due to the dynamic nature of the NFT, the value may change over time and fans can re-sell to each other. Since the act of following a streamer on Twitch costs nothing to the viewer, it has never been easier for a streamer to start earning income from their fans.",
     "image": "",
     "attributes": [
       {
         "trait_type": "ID",
         "value": 0
       },
       {
         "trait_type": "Follows",
         "value": 0
       }
     ]
   }

   let metadata = metadataTemplate
   const [twitchId, followCount] = await contract.getUriData(lvl)

   metadata['name'] = username
   metadata['image'] = profileURL
   metadata['attributes'][0]['value'] = parseInt(twitchId)
   metadata['attributes'][1]['value'] = parseInt(followCount)
   //console.log(metadata)

   return metadata;
 }

 const pinJSONToIPFS = async (pinataApiKey, pinataSecretApiKey, jsonData, contract, lvl) => {
     const url = `https://api.pinata.cloud/pinning/pinJSONToIPFS`;

     axios.post(url, jsonData, {
             headers: {
                 pinata_api_key: pinataApiKey,
                 pinata_secret_api_key: pinataSecretApiKey
             }
         })
         .then(async (response) => {
            const result = "https://gateway.pinata.cloud/ipfs/" + response.data.IpfsHash;
            //console.log(result);

            const pin = await contract.setURI(result);


         })
         .catch(function (error) {
             console.log(error)
         });
 };

 const pairAgain = async() => {
   //console.log(state);
   setPreviousState(state);
   //console.log(previousState);
   setState("pairagain");
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

  let renderMintButton;

  if (parseInt(allowed) > 0)
  {
    renderMintButton = <Button variant="outlined" onClick={() => setState("mint")}> Mint up to {allowed} NFTs</Button>
  }

  let rewardCount = "NFTs";

  if (level == 1)
  {
    rewardCount = "NFT";
  }

  if (state == "waiting")
  {
    return (
      <div>
      <Container>
        <p>Please wait...</p>
        <p>{waitMessage}</p>
      </Container>
      </div>
    );
  }
  else if (state == "registered")
  {
    return (
      <div>
      <Container>
      <img src={profileURL} position="fixed" width="25%" height="25%" style={{display: profileURL != "x" ? 'block' : 'none'}} />
      </Container>
      <Container>
        <p>Welcome, {username} </p>
        <p>Followers: {followers} / {toNextLevel}</p>
        <p>Next Reward: {level} {rewardCount}</p>

        <p>
         {renderMintButton}
        </p>

        <Button variant="outlined" onClick={() => checkFollowCount(props.provider, props.caddr)}>
         Sync Follower Count With Twitch</Button>

         <div>
         <Button variant="outlined" onClick={() => setPicture(props.provider, props.caddr)}>
          Sync Picture with Twitch</Button>
         </div>


          <Button variant="outlined" onClick={() => setURI(props.provider, props.caddr)}>
           Update Metadata (Token URI)</Button>

         <p>
         <Button variant="outlined" onClick={() => pairAgain()}>
          Link to a different account</Button>
         </p>

        </Container>

      </div>
    );
  }
  else if (state == "levelup")
    {

      return (
        <div>
        <Container>
          <p>Congratulations, you've reached a new milestone!</p>
          <p>By having {followers} total followers, you've earned {allowed} NFTs!</p>
          <form className={classes.root} noValidate autoComplete="off">
            <TextField onChange={(e) => handleInputMint(allowed, e)} id="mintField" label="Quantity"
            defaultValue={allowed} />
          </form>

           <Button variant="outlined" onClick={() => mintNFTs(props.provider, props.caddr, numberToMint)}>
            Mint {numberToMint} NFTs now</Button>
            <Button variant="outlined" onClick={() => setState("registered")}>
             Do it later</Button>
        </Container>
        </div>
      );
    }
  else if (state == "mint")
  {
    return (
      <div>
      <Container>
        <p>You can mint up to {allowed} NFTs.</p>
        <form className={classes.root} noValidate autoComplete="off">
          <TextField onChange={(e) => handleInputMint(allowed, e)} id="mintField" label="Quantity"
          defaultValue={allowed} />
        </form>

         <Button variant="outlined" onClick={() => mintNFTs(props.provider, props.caddr, numberToMint)}>
          Mint {numberToMint} NFTs now</Button>
          <Button variant="outlined" onClick={() => setState("registered")}>
           Do it later</Button>
      </Container>
      </div>
    );
  }
  else if (state == "verified")
  {
    return (
      <div>
      <Container>
      <p>Great, you've proven ownership of your Twitch account!</p>
      <p>Now just click the button below to link your wallet with this account.</p>
      <p>You can always do this again later if you lose access to your wallet or your Twitch account.</p>
        <Button variant="outlined" onClick={() => registerStreamer(props.provider, props.caddr, name)}>
         Link this wallet to {name}</Button>

         <Button variant="outlined" onClick={() => pairAgain()}>
          Link to a different account</Button>
        </Container>
      </div>
    );
  }
  else if (state == "update")
  {
    getData(props.provider, props.caddr);
    return (<div></div>);
  }
  else if (state == "pairagain")
  {
    return(
    <div>
      <Container>
      <ol>
      <li>Enter your Twitch username in the textbox below</li>
      <form className={classes.root} noValidate autoComplete="off">
        <TextField onChange={handleInput} id="nameField" label="Twitch username" />
      </form>
      <li>Change your Twitch bio to the wallet address you're using here</li>
      <li>Press the button below to check that the address and bio match</li>
      </ol>

      <Button variant="outlined" onClick={() => verifyStreamer(props.provider, props.caddr, name)}>
       Verify ownership of {name}</Button>

      <Button variant="outlined" onClick={() => setState(previousState)}>
       Cancel</Button>

     </Container>
    </div>
  );
  }
  else if (state == "failed")
  {
    return (
      <div>
        <Container>
          <p>Verification failed...</p>
          <p>Be sure that your Twitch bio exactly matches the wallet you are using to access this site.</p>

           <Button variant="outlined" onClick={() => setState("new")}>
            Try again</Button>

        </Container>
      </div>
    );
  }
  else if (state == "new")
  {
    return(
    <div>
      <Container>
        <p>Welcome to NFTwitch!</p>
        <p>Before starting, you must prove that you actually own a Twitch account.</p>
        <ol>
        <li>Enter your Twitch username in the textbox below</li>
        <form className={classes.root} noValidate autoComplete="off">
          <TextField onChange={handleInput} id="nameField" label="Twitch username" />
        </form>
        <li>Change your Twitch bio to the wallet address you're using here</li>
        <li>Press the button below to check that the address and bio match</li>
        </ol>

        <Button variant="outlined" onClick={() => verifyStreamer(props.provider, props.caddr, name)}>
         Verify ownership of {name}</Button>

       </Container>
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

  const contractAddress = process.env.REACT_APP_NFTWITCH_CONTRACT;

  return (
    <div>
    <ThemeProvider theme={darkTheme}>
      <Header>
        <Container style={{align: "left"}}><b>NFTwitch</b> - Earn NFTs as you grow your Twitch channel</Container>
        <WalletButton provider={provider} loadWeb3Modal={loadWeb3Modal} logoutOfWeb3Modal={logoutOfWeb3Modal} />
      </Header>
      <Body>
        <RenderPage provider={provider} caddr={contractAddress} />
        <Footer>
        <Container style={{align: "left", color: "white" }}><a style={{align: "left", color: "white" }} href="https://github.com/AntonStrickland/nftwitch">GitHub</a> | Contract Address {contractAddress}
        </Container>
        </Footer>
      </Body>
      </ThemeProvider>
    </div>
  );
}

export default App;
