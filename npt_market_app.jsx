I'll create a complete NPT Market application using React.js as the frontend and Clarity smart contracts as the backend for the Stacks blockchain!

Frontend (React.js)

package.json:

{
  "name": "npt-market-stacks",
  "version": "0.1.0",
  "private": true,
  "dependencies": {
    "@stacks/connect": "^7.8.1",
    "@stacks/network": "^6.13.0",
    "@stacks/transactions": "^6.13.0",
    "@stacks/auth": "^6.10.0",
    "@stacks/storage": "^6.10.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-scripts": "5.0.1",
    "web-vitals": "^2.1.4"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  },
  "eslintConfig": {
    "extends": [
      "react-app",
      "react-app/jest"
    ]
  },
  "browserslist": {
    "production": [
      ">0.2%",
      "not dead",
      "not op_mini all"
    ],
    "development": [
      "last 1 chrome version",
      "last 1 firefox version",
      "last 1 safari version"
    ]
  },
  "devDependencies": {
    "autoprefixer": "^10.4.7",
    "postcss": "^8.4.14",
    "tailwindcss": "^3.1.6"
  }
}

src/App.js:

import React, { useState, useEffect } from 'react';
import { Connect } from '@stacks/connect';
import { StacksTestnet } from '@stacks/network';
import { 
  makeContractCall,
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
  stringUtf8CV,
  uintCV,
  principalCV,
  callReadOnlyFunction,
  cvToJSON
} from '@stacks/transactions';
import { openContractCall } from '@stacks/connect';
import './App.css';

const App = () => {
  // Wallet and Network State
  const [userData, setUserData] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [network] = useState(new StacksTestnet());
  
  // Application State
  const [userSTX, setUserSTX] = useState(0);
  const [userNPTs, setUserNPTs] = useState([]);
  const [marketplaceItems, setMarketplaceItems] = useState([]);
  const [activeAuctions, setActiveAuctions] = useState([]);
  const [miningInProgress, setMiningInProgress] = useState(false);
  const [activeTab, setActiveTab] = useState('mining');
  const [miningAmount, setMiningAmount] = useState(10);
  const [showAuctionModal, setShowAuctionModal] = useState(false);
  const [selectedNPTForAuction, setSelectedNPTForAuction] = useState(null);
  const [startingBid, setStartingBid] = useState('');
  const [auctionDuration, setAuctionDuration] = useState('24');

  // Contract Configuration
  const contractAddress = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM'; // Replace with your deployed contract
  const contractName = 'npt-market';

  // Initialize Stacks Connect
  const appConfig = {
    name: 'NPT Market',
    icon: window.location.origin + '/logo192.png',
  };

  const connectWallet = () => {
    const authOptions = {
      redirectTo: '/',
      finished: (payload) => {
        setUserData(payload.userSession.loadUserData());
        setIsConnected(true);
        loadUserData();
      },
      appDetails: appConfig,
    };
    
    Connect.authenticate(authOptions);
  };

  const disconnectWallet = () => {
    setUserData(null);
    setIsConnected(false);
    setUserSTX(0);
    setUserNPTs([]);
  };

  // Load user data from blockchain
  const loadUserData = async () => {
    if (!userData) return;

    try {
      // Get user's STX balance
      const balanceResponse = await fetch(
        `https://stacks-node-api.testnet.stacks.co/extended/v1/address/${userData.profile.stxAddress.testnet}/balances`
      );
      const balanceData = await balanceResponse.json();
      setUserSTX(parseInt(balanceData.stx.balance) / 1000000); // Convert microSTX to STX

      // Get user's NPTs
      await loadUserNPTs();
      
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  // Load user's NPTs from contract
  const loadUserNPTs = async () => {
    if (!userData) return;

    try {
      const functionArgs = [principalCV(userData.profile.stxAddress.testnet)];
      
      const result = await callReadOnlyFunction({
        contractAddress,
        contractName,
        functionName: 'get-user-npts',
        functionArgs,
        network,
        senderAddress: userData.profile.stxAddress.testnet,
      });

      const npts = cvToJSON(result).value;
      setUserNPTs(npts || []);
    } catch (error) {
      console.error('Error loading user NPTs:', error);
    }
  };

  // Load marketplace items
  const loadMarketplaceItems = async () => {
    try {
      const result = await callReadOnlyFunction({
        contractAddress,
        contractName,
        functionName: 'get-marketplace-items',
        functionArgs: [],
        network,
        senderAddress: userData?.profile.stxAddress.testnet || contractAddress,
      });

      const items = cvToJSON(result).value;
      setMarketplaceItems(items || []);
    } catch (error) {
      console.error('Error loading marketplace items:', error);
      // Fallback to mock data for demo
      setMarketplaceItems([
        { id: 1, name: 'Crystal NPT #442', rarity: 'Legendary', emoji: '🌟', price: 85, seller: 'CryptoMiner99' },
        { id: 2, name: 'Diamond NPT #221', rarity: 'Rare', emoji: '💎', price: 32, seller: 'BlockchainPro' },
        { id: 3, name: 'Emerald NPT #156', rarity: 'Rare', emoji: '💎', price: 28, seller: 'STXTrader' },
      ]);
    }
  };

  // Load active auctions
  const loadActiveAuctions = async () => {
    try {
      const result = await callReadOnlyFunction({
        contractAddress,
        contractName,
        functionName: 'get-active-auctions',
        functionArgs: [],
        network,
        senderAddress: userData?.profile.stxAddress.testnet || contractAddress,
      });

      const auctions = cvToJSON(result).value;
      setActiveAuctions(auctions || []);
    } catch (error) {
      console.error('Error loading auctions:', error);
      // Fallback to mock data for demo
      setActiveAuctions([
        { id: 1, name: 'Mystic NPT #888', rarity: 'Legendary', emoji: '🌟', currentBid: 95, timeLeft: '2h 15m', bidder: 'HighRoller', bids: 12 },
        { id: 2, name: 'Rare NPT #445', rarity: 'Rare', emoji: '💎', currentBid: 38, timeLeft: '5h 42m', bidder: 'BidMaster', bids: 7 },
      ]);
    }
  };

  // Mining Functions
  const startMining = async () => {
    if (!isConnected || miningInProgress) {
      alert('Please connect your wallet first!');
      return;
    }

    if (miningAmount > userSTX) {
      alert('Insufficient STX balance!');
      return;
    }

    setMiningInProgress(true);

    try {
      const functionArgs = [uintCV(miningAmount * 1000000)]; // Convert STX to microSTX

      await openContractCall({
        network,
        anchorMode: AnchorMode.Any,
        contractAddress,
        contractName,
        functionName: 'mine-npt',
        functionArgs,
        postConditionMode: PostConditionMode.Allow,
        onFinish: (data) => {
          console.log('Mining transaction submitted:', data.txId);
          setMiningInProgress(false);
          // Refresh user data after mining
          setTimeout(() => {
            loadUserData();
            loadUserNPTs();
          }, 10000); // Wait for transaction to be mined
        },
        onCancel: () => {
          setMiningInProgress(false);
        },
      });
    } catch (error) {
      console.error('Mining error:', error);
      setMiningInProgress(false);
      alert('Mining failed. Please try again.');
    }
  };

  // Buy NPT from marketplace
  const buyNPT = async (itemId) => {
    if (!isConnected) {
      alert('Please connect your wallet first!');
      return;
    }

    const item = marketplaceItems.find(i => i.id === itemId);
    if (!item) return;

    if (userSTX < item.price) {
      alert('Insufficient STX balance!');
      return;
    }

    try {
      const functionArgs = [uintCV(itemId)];

      await openContractCall({
        network,
        anchorMode: AnchorMode.Any,
        contractAddress,
        contractName,
        functionName: 'buy-npt',
        functionArgs,
        postConditionMode: PostConditionMode.Allow,
        onFinish: (data) => {
          console.log('Purchase transaction submitted:', data.txId);
          alert(`Purchase submitted! Transaction ID: ${data.txId}`);
          // Refresh data after purchase
          setTimeout(() => {
            loadUserData();
            loadUserNPTs();
            loadMarketplaceItems();
          }, 10000);
        },
        onCancel: () => {
          console.log('Purchase cancelled');
        },
      });
    } catch (error) {
      console.error('Purchase error:', error);
      alert('Purchase failed. Please try again.');
    }
  };

  // Place bid on auction
  const placeBid = async (auctionId, bidAmount) => {
    if (!isConnected) {
      alert('Please connect your wallet first!');
      return;
    }

    const auction = activeAuctions.find(a => a.id === auctionId);
    if (!auction) return;

    if (!bidAmount || bidAmount <= auction.currentBid) {
      alert('Bid must be higher than current bid!');
      return;
    }

    if (bidAmount > userSTX) {
      alert('Insufficient STX balance!');
      return;
    }

    try {
      const functionArgs = [uintCV(auctionId), uintCV(bidAmount * 1000000)];

      await openContractCall({
        network,
        anchorMode: AnchorMode.Any,
        contractAddress,
        contractName,
        functionName: 'place-bid',
        functionArgs,
        postConditionMode: PostConditionMode.Allow,
        onFinish: (data) => {
          console.log('Bid transaction submitted:', data.txId);
          alert(`Bid placed! Transaction ID: ${data.txId}`);
          // Refresh auctions after bid
          setTimeout(() => {
            loadActiveAuctions();
            loadUserData();
          }, 10000);
        },
        onCancel: () => {
          console.log('Bid cancelled');
        },
      });
    } catch (error) {
      console.error('Bid error:', error);
      alert('Bid failed. Please try again.');
    }
  };

  // Sell NPT
  const sellNPT = async (nptId) => {
    if (!isConnected) {
      alert('Please connect your wallet first!');
      return;
    }

    const npt = userNPTs.find(n => n.id === nptId);
    if (!npt) return;

    const sellPrice = Math.floor(npt.value * 0.9);

    if (window.confirm(`Sell ${npt.name} for ${sellPrice} STX? (10% marketplace fee applied)`)) {
      try {
        const functionArgs = [uintCV(nptId), uintCV(sellPrice * 1000000)];

        await openContractCall({
          network,
          anchorMode: AnchorMode.Any,
          contractAddress,
          contractName,
          functionName: 'list-npt-for-sale',
          functionArgs,
          postConditionMode: PostConditionMode.Allow,
          onFinish: (data) => {
            console.log('Listing transaction submitted:', data.txId);
            alert(`NPT listed for sale! Transaction ID: ${data.txId}`);
            // Refresh data after listing
            setTimeout(() => {
              loadUserNPTs();
              loadMarketplaceItems();
            }, 10000);
          },
          onCancel: () => {
            console.log('Listing cancelled');
          },
        });
      } catch (error) {
        console.error('Listing error:', error);
        alert('Listing failed. Please try again.');
      }
    }
  };

  // Create auction
  const createAuction = async () => {
    if (!isConnected) {
      alert('Please connect your wallet first!');
      return;
    }

    if (!selectedNPTForAuction || !startingBid) {
      alert('Please fill in all fields!');
      return;
    }

    try {
      const functionArgs = [
        uintCV(selectedNPTForAuction.id),
        uintCV(parseInt(startingBid) * 1000000),
        uintCV(parseInt(auctionDuration))
      ];

      await openContractCall({
        network,
        anchorMode: AnchorMode.Any,
        contractAddress,
        contractName,
        functionName: 'create-auction',
        functionArgs,
        postConditionMode: PostConditionMode.Allow,
        onFinish: (data) => {
          console.log('Auction creation transaction submitted:', data.txId);
          alert(`Auction created! Transaction ID: ${data.txId}`);
          setShowAuctionModal(false);
          setSelectedNPTForAuction(null);
          setStartingBid('');
          // Refresh data after auction creation
          setTimeout(() => {
            loadUserNPTs();
            loadActiveAuctions();
          }, 10000);
        },
        onCancel: () => {
          console.log('Auction creation cancelled');
        },
      });
    } catch (error) {
      console.error('Auction creation error:', error);
      alert('Auction creation failed. Please try again.');
    }
  };

  // Load data on component mount and wallet connection
  useEffect(() => {
    loadMarketplaceItems();
    loadActiveAuctions();
  }, []);

  useEffect(() => {
    if (isConnected && userData) {
      loadUserData();
    }
  }, [isConnected, userData]);

  // Calculate portfolio stats
  const portfolioStats = {
    totalNPTs: userNPTs.length,
    totalValue: userNPTs.reduce((sum, npt) => sum + (npt.value || 0), 0),
    rareCount: userNPTs.filter(npt => npt.rarity !== 'Common').length
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Header */}
      <header className="bg-black text-white shadow-lg">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                <span className="text-2xl">⛏️</span>
              </div>
              <h1 className="text-2xl font-bold">NPT Market</h1>
            </div>
            <div className="flex items-center space-x-6">
              {isConnected && (
                <div className="bg-white/20 rounded-lg px-4 py-2">
                  <span className="text-sm">STX Balance: </span>
                  <span className="font-semibold">{userSTX.toFixed(2)}</span>
                </div>
              )}
              {isConnected ? (
                <div className="flex items-center space-x-4">
                  <span className="text-sm">
                    {userData?.profile?.stxAddress?.testnet?.slice(0, 8)}...
                  </span>
                  <button
                    onClick={disconnectWallet}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  onClick={connectWallet}
                  className="bg-white text-black px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors"
                >
                  Connect Wallet
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        {!isConnected ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-6">🔗</div>
            <h2 className="text-3xl font-bold text-gray-800 mb-4">Connect Your Stacks Wallet</h2>
            <p className="text-gray-600 mb-8">Connect your Stacks wallet to start mining, trading, and auctioning NPTs!</p>
            <button
              onClick={connectWallet}
              className="bg-black text-white px-8 py-4 rounded-lg font-semibold hover:bg-gray-800 transition-colors text-lg"
            >
              Connect Wallet
            </button>
          </div>
        ) : (
          <>
            {/* Navigation Tabs */}
            <div className="flex space-x-1 bg-white rounded-lg p-1 shadow-sm mb-8">
              {[
                { id: 'mining', label: '⛏️ Mining' },
                { id: 'marketplace', label: '🏪 Marketplace' },
                { id: 'auctions', label: '🔨 Auctions' },
                { id: 'portfolio', label: '💼 My NPTs' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 py-3 px-4 rounded-md font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-black text-white'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Mining Section */}
            {activeTab === 'mining' && (
              <div className="grid lg:grid-cols-2 gap-8">
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h2 className="text-2xl font-bold text-gray-800 mb-6">Mine New NPTs</h2>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Mining Power (STX)</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={miningAmount}
                          onChange={(e) => setMiningAmount(parseInt(e.target.value) || 0)}
                          min="1"
                          max="100"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                        />
                        <span className="absolute right-3 top-3 text-gray-500">STX</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">Higher amounts increase rare NPT chances</p>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-800 mb-3">Mining Probabilities</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Common (70%)</span>
                          <span className="text-green-600">✨ Basic NPT</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Rare (25%)</span>
                          <span className="text-blue-600">💎 Enhanced NPT</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Legendary (5%)</span>
                          <span className="text-purple-600">🌟 Epic NPT</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={startMining}
                      disabled={miningInProgress}
                      className="w-full bg-black text-white py-4 rounded-lg font-semibold hover:bg-gray-800 transition-colors disabled:opacity-60"
                    >
                      {miningInProgress ? 'Mining Transaction Pending...' : 'Start Mining ⛏️'}
                    </button>

                    {miningInProgress && (
                      <div className="text-center text-gray-600">
                        <p>Please confirm the transaction in your wallet...</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h2 className="text-2xl font-bold text-gray-800 mb-6">My Recent NPTs</h2>
                  <div className="space-y-4">
                    {userNPTs.length === 0 ? (
                      <div className="text-center text-gray-500 py-8">
                        <span className="text-4xl mb-4 block">⛏️</span>
                        <p>No NPTs mined yet!</p>
                        <p className="text-sm">Start mining to build your collection!</p>
                      </div>
                    ) : (
                      userNPTs.slice(0, 5).map((npt, index) => (
                        <div key={index} className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4 border-l-4 border-black">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <span className="text-2xl">{npt.emoji || '✨'}</span>
                              <div>
                                <div className="font-semibold text-gray-800">{npt.name || `NPT #${index + 1}`}</div>
                                <div className="text-sm text-gray-600">{npt.rarity || 'Common'} • {npt.value || 10} STX value</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Marketplace Section */}
            {activeTab === 'marketplace' && (
              <div>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-800 mb-4">NPT Marketplace</h2>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {marketplaceItems.map(item => (
                    <MarketplaceCard key={item.id} item={item} onBuy={buyNPT} />
                  ))}
                </div>
              </div>
            )}

            {/* Auctions Section */}
            {activeTab === 'auctions' && (
              <div>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-800 mb-4">Live Auctions</h2>
                  <button
                    onClick={() => setShowAuctionModal(true)}
                    className="bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    Create Auction
                  </button>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {activeAuctions.map(auction => (
                    <AuctionCard key={auction.id} auction={auction} onBid={placeBid} />
                  ))}
                </div>
              </div>
            )}

            {/* Portfolio Section */}
            {activeTab === 'portfolio' && (
              <div>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-800 mb-4">My NPT Collection</h2>
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-black">{portfolioStats.totalNPTs}</div>
                        <div className="text-sm text-gray-600">Total NPTs</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-green-600">{portfolioStats.totalValue}</div>
                        <div className="text-sm text-gray-600">Total Value (STX)</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-blue-600">{portfolioStats.rareCount}</div>
                        <div className="text-sm text-gray-600">Rare+ NPTs</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {userNPTs.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-gray-500">
                      <span className="text-6xl mb-4 block">💼</span>
                      <p className="text-lg">No NPTs in your collection yet</p>
                      <p className="text-sm">Start mining to build your collection!</p>
                    </div>
                  ) : (
                    userNPTs.map((npt, index) => (
                      <PortfolioCard
                        key={index}
                        npt={{...npt, id: index}}
                        onSell={sellNPT}
                        onAuction={(id) => {
                          setSelectedNPTForAuction({...npt, id});
                          setStartingBid(Math.floor((npt.value || 10) * 0.8).toString());
                          setShowAuctionModal(true);
                        }}
                      />
                    ))
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Auction Modal */}
      {showAuctionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4">Create Auction</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Selected NPT</label>
                <div className="p-3 bg-gray-50 rounded-lg">
                  {selectedNPTForAuction ? (
                    <span>{selectedNPTForAuction.name || 'Selected NPT'} ({selectedNPTForAuction.rarity || 'Common'})</span>
                  ) : (
                    <span className="text-gray-500">No NPT selected</span>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Starting Bid (STX)</label>
                <input
                  type="number"
                  value={startingBid}
                  onChange={(e) => setStartingBid(e.target.value)}
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Auction Duration</label>
                <select
                  value={auctionDuration}
                  onChange={(e) => setAuctionDuration(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="1">1 Hour</option>
                  <option value="6">6 Hours</option>
                  <option value="24">24 Hours</option>
                  <option value="72">3 Days</option>
                </select>
              </div>
              <div className="flex space-x-3 pt-4">
                <button
                  onClick={createAuction}
                  className="flex-1 bg-black text-white py-2 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Create Auction
                </button>
                <button
                  onClick={() => {
                    setShowAuctionModal(false);
                    setSelectedNPTForAuction(null);
                    setStartingBid('');
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Component definitions remain the same...
const MarketplaceCard = ({ item, onBuy }) => (
  <div className="bg-white rounded-xl shadow-lg p-6 card-hover">
    <div className="text-center mb-4">
      <div className="text-4xl mb-2">{item.emoji}</div>
      <h3 className="font-bold text-gray-800">{item.name}</h3>
      <p className="text-sm text-gray-600">{item.rarity}</p>
    </div>
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-gray-600">Price:</span>
        <span className="font-bold text-black">{item.price} STX</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-gray-600">Seller:</span>
        <span className="text-sm text-gray-800">{item.seller}</span>
      </div>
      <button
        onClick={() => onBuy(item.id)}
        className="w-full bg-black text-white py-2 rounded-lg hover:bg-gray-800 transition-colors"
      >
        Buy Now
      </button>
    </div>
  </div>
);

const AuctionCard = ({ auction, onBid }) => {
  const [bidAmount, setBidAmount] = useState('');

  const handleBid = () => {
    const amount = parseInt(bidAmount);
    if (amount) {
      onBid(auction.id, amount);
      setBidAmount('');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 card-hover">
      <div className="text-center mb-4">
        <div className="text-4xl mb-2">{auction.emoji}</div>
        <h3 className="font-bold text-gray-800">{auction.name}</h3>
        <p className="text-sm text-gray-600">{auction.rarity}</p>
      </div>
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Current Bid:</span>
          <span className="font-bold text-green-600">{auction.currentBid} STX</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Time Left:</span>
          <span className="text-sm font-medium text-red-600">{auction.timeLeft}</span>
        </div>
        <div className="flex space-x-2">
          <input
            type="number"
            placeholder="Bid amount"
            value={bidAmount}
            onChange={(e) => setBidAmount(e.target.value)}
            min={auction.currentBid + 1}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <button
            onClick={handleBid}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm"
          >
            Bid
          </button>
        </div>
      </div>
    </div>
  );
};

const PortfolioCard = ({ npt, onSell, onAuction }) => (
  <div className="bg-white rounded-xl shadow-lg p-6 card-hover">
    <div className="text-center mb-4">
      <div className="text-4xl mb-2">{npt.emoji || '✨'}</div>
      <h3 className="font-bold text-gray-800">{npt.name || `NPT #${npt.id}`}</h3>
      <p className="text-sm text-gray-600">{npt.rarity || 'Common'}</p>
    </div>
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-gray-600">Value:</span>
        <span className="font-bold text-black">{npt.value || 10} STX</span>
      </div>
      <div className="flex space-x-2">
        <button
          onClick={() => onSell(npt.id)}
          className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors text-sm"
        >
          Sell
        </button>
        <button
          onClick={() => onAuction(npt.id)}
          className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
        >
          Auction
        </button>
      </div>
    </div>
  </div>
);

export default App;