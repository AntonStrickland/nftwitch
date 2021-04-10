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
  const [profileURL, setProfileURL] = useState("");

  const getOffchainTwitchInfo = async (provider, caddr) => {

    if (gotTwitchInfo) return;
    setGotTwitchInfo(true);

    const signer = provider.getSigner();
    const contract = new Contract(caddr, abis.test, signer);
    const id = parseInt(await contract.getIdFromWallet()).toString();

    if (id)
    {

      var getTokenConfig = {
          url: 'https://id.twitch.tv/oauth2/token',
          method: 'POST',
          params: {
            client_id: process.env.REACT_APP_TWITCH_KEY,
            client_secret: process.env.REACT_APP_TWITCH_SECRET,
            grant_type: 'client_credentials'
          }
        }

      var accessToken = 'failed to get token';
      const td = axios.request(getTokenConfig)
      .then((response) => {

        accessToken = response.data.access_token

        const url = "https://api.twitch.tv/helix/users"

        const params = {
          id
        }

        const config = {
          url,
          params,
          method: "GET",
          headers: {
            "Client-ID": process.env.REACT_APP_TWITCH_KEY,
            'Authorization': 'Bearer ' + accessToken
          }
        }


        axios.request(config).then(response => {

            // A quick fix around the Twitch api's data container
            var fixed = JSON.stringify(response.data);
            fixed = fixed.replace('[', '');
            fixed = fixed.replace(']', '');
            response.data = JSON.parse(fixed);

            setUsername(response.data.data.login);
            setProfileURL(response.data.data.profile_image_url);

            response.status = 200;
          })


      });


    }


  }

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

 const handleInputMint = (allowed, event) => {

   if (parseInt(event.target.value) <= allowed)
   {
       setNumberToMint(event.target.value);
   }
};


 const getData = async (provider, caddr) => {

  const signer = provider.getSigner();
  const contract = new Contract(caddr, abis.test, signer);

  const [level, follow, lastFollow, reqFollow, allowed] = await contract.getStreamerData();

  setLevel(level.toString());
  setFollowers(follow.toString());
  setToThisLevel(lastFollow.toString());
  setToNextLevel(reqFollow.toString());
  setAllowed(allowed.toString());

  const uri = await contract.getTokenURI(0);
  console.log("URI: " + uri.toString());

  if (allowed > 0)
  {
    setState("mint");
  }
  else {
    setState("registered");
  }
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
   console.log(signer);
   const contract = new Contract(caddr, abis.test, signer);

   console.log(contract);
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

     console.log("Next ID: " + nextId.toString());
     console.log("Success: " + success.toString());

     const signer = provider.getSigner();
     console.log(signer);
     const con = new Contract(caddr, abis.test, signer);
     console.log(con);

     const startToken = nextId - parseInt(numberToMint) + 1;
     console.log("number: " + numberToMint);
     console.log("start: " + startToken);

     const endToken = parseInt(startToken) + parseInt(numberToMint);

     try
     {

       // TODO: We can't just do these in order,
       // but only within our tokenIndices!

       // Also, it'd be a pain to mint tons of NFTs because
       // we'd need to sign for them individually,
       // so do some kind of bulk metadata creation


       // For each NFT we just minted, update the metadata URI
       for(var token = startToken; token < endToken; token++)
       {
         console.log(token);
         console.log(endToken);
         const jsonData = await createJsonData(token, con);
         console.log("pin");
         const pinnedURI = await pinJSONToIPFS(process.env.REACT_APP_PINATA_KEY,
           process.env.REACT_APP_PINATA_SECRET, jsonData, con, token);
       }

     } catch (e) {
       console.log(e);
     }

     setState("update");
   });
 }

 const testPin = async (provider, caddr) => {
   const token = 0;
   const signer = provider.getSigner();
   const contract = new Contract(caddr, abis.test, signer);
   const jsonData = await createJsonData(token, contract);
   const pinnedURI = await pinJSONToIPFS(process.env.REACT_APP_PINATA_KEY,
     process.env.REACT_APP_PINATA_SECRET, jsonData, contract, token);

 }

 const createJsonData = async (tokenId, contract) => {

   const metadataTemplate =
   {
     "name": "Streamer Name",
     "description": "A Twitch streamer",
     "image": "",
     "attributes": [
       {
         "trait_type": "ID",
         "value": 0
       }
     ]
   }

   let metadata = metadataTemplate
   const [tw, followCount, y] = await contract.getTokenData(tokenId)

   metadata['name'] = username
   metadata['image'] = profileURL
   metadata['attributes'][0]['value'] = parseInt(tw)
   metadata['attributes'][1]['value'] = parseInt(followCount)
   console.log(metadata)

   return metadata;
 }

 const pinJSONToIPFS = async (pinataApiKey, pinataSecretApiKey, jsonData, contract, token) => {
     const url = `https://api.pinata.cloud/pinning/pinJSONToIPFS`;

     axios.post(url, jsonData, {
             headers: {
                 pinata_api_key: pinataApiKey,
                 pinata_secret_api_key: pinataSecretApiKey
             }
         })
         .then(async (response) => {
            const result = "https://gateway.pinata.cloud/ipfs/" + response.data.IpfsHash;
            console.log(result);
            const pin = await contract.setTokenURI(token, result);
         })
         .catch(function (error) {
             console.log("ERROR")
             console.log(error)
         });
 };

 const pairAgain = async() => {
   console.log(state);
   setPreviousState(state);
   console.log(previousState);
   setState("pairagain");
 }

 const displayFollowerCount = async (contract) => {
   console.log('Demo fulfilled!');
   const followerCount = await contract.followerCount();
   console.log(followerCount);
   alert(followerCount);
 }

const checkGas = async (provider, caddr) => {
  const signer = provider.getSigner();
  const contract = new Contract(caddr, abis.test, signer);

  console.log("Checking gas...");
  const gasValue = await contract.estimateGas.requestFollows(
    "0xa333365f5cCd13a7ee33FaccDE25eb629cA89DdF",
    "e518420de0ad4b06a2da4278f787d33b"
  );

  console.log(gasValue.toString());
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

  if (parseInt(level) > 0)
  {
    getOffchainTwitchInfo(props.provider, props.caddr);
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
      <img src={profileURL} position="fixed" width="50%" height="50%" />
      </Container>
      <Container>
        <p>Welcome, {username} </p>
        <p>Followers: {followers} / {toNextLevel}</p>
        <p>Next Reward: {level} NFTs</p>

        <p>
         {renderMintButton}
        </p>

        <Button variant="outlined" onClick={() => checkFollowCount(props.provider, props.caddr)}>
         Sync Follower Count With Twitch</Button>

         <p>
         <Button variant="outlined" onClick={() => pairAgain()}>
          Link to a different account</Button>
         </p>

         <p>
         <Button variant="outlined" onClick={() => testPin(props.provider, props.caddr)}>
          Test Pin</Button>
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

       <Button variant="outlined" onClick={() => withdrawLink(props.provider, props.caddr)}>
        Withdraw LINK</Button>
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

  const contractAddress = "0xE2264c9C613143Aa090D4d74902A85F1688C4Ba1";

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
        <Container style={{align: "left", color: "white" }}>Contract Address {contractAddress}</Container>
        </Footer>
      </Body>
      </ThemeProvider>
    </div>
  );
}

export default App;
