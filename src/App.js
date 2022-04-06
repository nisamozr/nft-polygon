import React, { useEffect, useState } from "react";
import './styles/App.css';
import coverphot from './assets/undraw_art_museum_-8-or4.svg'
import { ethers } from "ethers"
import { Biconomy } from "@biconomy/mexa";
import myNft from "./EYENFTS.json"
import { MerkleTree } from "merkletreejs"
import keccak256 from "keccak256"
import { whitelistAddresses } from "./whitelist"
import {networks} from "./networks"
import Swal from 'sweetalert2'

const leafNodes = whitelistAddresses.map(addr => keccak256(addr));
const merkleTree = new MerkleTree(leafNodes, keccak256, { sortPairs: true });
const CONTRACT_ADDRESS = "0x88Ea84aDf262016d0f5F03ADbE7D1C30E887a84e"; //mumbai
// const CONTRACT_ADDRESS = "0x1280A4C2f630DB5EdBf993156cEFC32ce08aC4AA"  //rinkeby
// const CONTRACT_ADDRESS = "0x4d3bDA5a944e7A8c5806935c209825268a931fdd"  //kovan

let ethersProvider, walletProvider, walletSigner
let contract, contractInterface
let biconomy



const App = () => {
  const [currentAccount, setCurrentAccount] = useState("");
  const [selectedAddress, setSelectedAddress] = useState('')
  const [loading, setloading] = useState(false);
  const [network, setNetwork] = useState('')

  const init = async () => {
    if (typeof window.ethereum !== 'undefined' && window.ethereum.isMetaMask) {
      // setInitLoading(0)

      biconomy = new Biconomy(window.ethereum, {
        apiKey: 'wfs01mJEi.5466428b-5bfd-467b-9782-a2ab309cc776',
        debug: true,
      })
      console.log(biconomy, "fdgdg")

      // two providers one with biconomy andd other for the wallet signing the transaction
      ethersProvider = new ethers.providers.Web3Provider(biconomy)
      walletProvider = new ethers.providers.Web3Provider(window.ethereum)
      walletSigner = walletProvider.getSigner()

      let userAddress = await walletSigner.getAddress()
      setSelectedAddress(userAddress)

      // init dApp stuff like contracts and interface
      biconomy
        .onEvent(biconomy.READY, async () => {
          contract = new ethers.Contract(
            CONTRACT_ADDRESS,
            myNft.abi,
            biconomy.getSignerByAddress(userAddress)
          )

          contractInterface = new ethers.utils.Interface(myNft.abi)
          setloading(false)
          // setInitLoading(1)
        })
        .onEvent(biconomy.ERROR, (error, message) => {
          console.log(message)
          console.log(error)
        })
    } else {
      console.log('Metamask not installed')
    }
  }

  const checkIfWalletIsConnected = async () => {
    const { ethereum } = window;

    if (!ethereum) {
      console.log("Make sure you have metamask!");
      return;
    } else {
      console.log("We have the ethereum object", ethereum);
    }
    const accounts = await ethereum.request({ method: 'eth_accounts' });

    if (accounts.length !== 0) {
      const account = accounts[0];
      console.log("Found an authorized account:", account);
      setCurrentAccount(account)
      switchNetwork()
     
      // setupEventListener()
    } else {
      console.log("No authorized account found")
    }

    // This is the new part, we check the user's network chain ID
    const chainId = await ethereum.request({ method: 'eth_chainId' })
    setNetwork(networks[chainId])

    ethereum.on('chainChanged', handleChainChanged)

    function handleChainChanged(_chainId) {
      window.location.reload()
    }
  }


  const connectWallet = async () => {
    try {
      const { ethereum } = window;
      if (!ethereum) {
        alert("Get MetaMask!");
        return;
      }
      const accounts = await ethereum.request({ method: "eth_requestAccounts" });
      console.log("Connected", accounts[0]);
      setCurrentAccount(accounts[0]);

      switchNetwork()
      // setupEventListener()
    } catch (error) {
      console.log(error)
    }
  }

  const switchNetwork = async () => {
    if (window.ethereum) {
      try {
        // Try to switch to the Mumbai testnet
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x13881' }], // Check networks.js for hexadecimal network ids
        })
      } catch (error) {
        // This error code means that the chain we want has not been added to MetaMask
        // In this case we ask the user to add it to their MetaMask
        if (error.code === 4902) {
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: '0x13881',
                  chainName: 'Testnet',
                  rpcUrls: [
                    'https://rpc-mumbai.maticvigil.com',
                  ],
                  nativeCurrency: {
                    name: 'MATIC',
                    symbol: 'MATIC',
                    decimals: 18,
                  },
                  blockExplorerUrls: ['https://mumbai.polygonscan.com/'],
                },
              ],
            })
          } catch (error) {
            console.log(error)
          }
        }
        console.log(error)
      }
    } else {
      // If window.ethereum is not found then MetaMask is not installed
      alert(
        'MetaMask is not installed. Please install it to use this app: https://metamask.io/download.html'
      )
    }
  }


  const askContractToMintNft = async () => {
    try {
      if(currentAccount != ''){
      setloading(true)
      const { ethereum } = window;
      if (ethereum) {
        let userAddress = selectedAddress
 
          const claimingAddress = keccak256(currentAccount);
          const hexProof = merkleTree.getHexProof(claimingAddress);
        console.log(biconomy)
          let provider = biconomy.getEthersProvider();
          let { data } = await contract.populateTransaction.mintNFT(hexProof);
          let gasLimit = await provider.estimateGas({
            to: CONTRACT_ADDRESS,
            from: userAddress,
            data: data
          });
          console.log("Gas limit : ", gasLimit);

          let txParams = {
            data: data,
            to: CONTRACT_ADDRESS,
            from: userAddress,
            gasLimit: 10000000,
            signatureType: "EIP712_SIGN"
          };
          console.log(txParams)

          let tx
          try {
            tx = await provider.send("eth_sendTransaction", [txParams])
          }
          catch (err) {
            console.log("handle errors like signature denied here");
            console.log(err);
          }
          console.log("Transaction hash : ", tx);
          provider.once(tx, (transaction) => {
            console.log(transaction, "emited");
            setloading(false)
            Swal.fire({
              title: 'Minting successfull',
              html:
                'Hey there! we are minted successfully completed.' +
                `<a href=' https://mumbai.polygonscan.com/tx/${transaction.transactionHash}'>mumbai.polygonscan.com</a> ` +
                '',
              width: 600,
              padding: '3em',
              color: '#716add',
              background: '#fff url(/images/trees.png)',
              backdrop: `
                rgba(0,0,123,0.4)
                url("/images/nyan-cat.gif")
                left top
                no-repeat
              `
            })
          });

          console.log("Going to pop wallet now to pay gas...")
          console.log("Mining...please wait.")
          
       
      } else {
        console.log("Ethereum object doesn't exist!");
      }
    }else{
      Swal.fire(
        'Connect wallet',
        'Befor mint connect with wallet',
        'question'
      )
    }
      
    } catch (error) {
      setloading(false)
      if(error.data.message == "execution reverted: Invalid Merkle Proof."){
      Swal.fire({
        icon: 'error',
        title: 'Minting Failed',
        text: 'You are not in whitelist ',
       
      })
      
    }else if(error.data.message == "execution reverted: Address already claimed"){
      Swal.fire({
        icon: 'error',
        title: 'Minting Failed',
        text: 'You are already claimed',
       
      })
    }else{
      Swal.fire({
        icon: 'error',
        title: 'Minting Failed',
        text: error.data.message,
       
      })

    }
      console.log(error)
    }
  }

  useEffect(() => {
    checkIfWalletIsConnected();
    if(currentAccount != ''){
      setloading(true)
    }

    if (currentAccount !== '' && network === 'Polygon Mumbai Testnet') {
      console.log('init')
      init()
    }
  }, [currentAccount, network])


  const renderNotConnectedContainer = () => (
    <button onClick={connectWallet} className="cta-button connect-wallet-button">
      Connect to Wallet
    </button>
  );

  return (
    <div className="App">
      {
        loading ?
          <div className="loading">
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
          </div>
          :
          ""}
      <div className={loading ? "container disabledbutton" : "container"}>
        <div className="nav header-container">
          <div className="connect">
            {currentAccount === "" ? (
              renderNotConnectedContainer()
            ) : (
              ""
            )}
          </div>
        </div>
        <div className="container">
          <div className="row body">
            <div className="col-md-6 tesboddy ff">
              <p className="header gradient-text">Eye On NFT</p>
              <p className="sub-text">
                I acn see you. Discover your NFT today.
              </p>
              <div className=" mint_div ">
                <button onClick={askContractToMintNft} className="cta-button connect-wallet-button">
                  Mint NFT
                </button>
                <a href="https://testnets.opensea.io/collection/eye-on-v4" target="_blank"><img className="opensee" src="https://storage.googleapis.com/opensea-static/Logomark/Logomark-White.png" alt="" srcset="" /></a>
              </div>
            </div>
            <div className="col-md-6 ff">
              <div className="img">
                <img src={coverphot} alt="" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;