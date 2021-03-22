# nftwitch
Earn dynamic NFTs as you grow your Twitch channel, for Chainlink Hackathon 2021

# Project Structure
This project is composed of three parts:
1. The front-end web app (my-eth-app)
2. The dynamic NFT contracts (dynamic-nft)
3. Custom-built external adapter for Twitch (cl-ea-twitch)

# Purpose
By interacting with smart contracts and Chainlink oracles, Twitch streamers can mint dynamic NFTs as they grow their channels. Every X followers, the streamer is allowed to mint Y NFTs that they can then re-sell to their fans directly or on open marketplaces. Both parties have something to gain: the funds can be used as a source of income to help bootstrap a streamer, and fans can hold onto a rare and unique, one-of-a-kind collectible. Due to the dynamic nature of the NFT, the value may change over time and fans can re-sell to each other. Since the act of following a streamer on Twitch costs nothing to the viewer, it has never been easier for a streamer to start earning income from their fans.

# How it works
Streamers register with a smart contract via the front-end, using Chainlink's API to verify ownership of their Twitch account. Streamers can periodically return to the site and mint a number of NFTs when a new follower threshold is reached (verified by Chainlink). Additionally, these NFTs make use of Chainlink's VRF to have some randomized information that may be valuable to different fans and encourage trading or ownership. Upon minting, the NFTs are allocated to the streamer and can then be redistributed and/or sold to fans.

