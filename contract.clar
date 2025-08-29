;; NPT Market Smart Contract
;; A decentralized marketplace for mining, trading, and auctioning NPTs (Non-Fungible Tokens)

;; Constants
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-found (err u101))
(define-constant err-insufficient-funds (err u102))
(define-constant err-unauthorized (err u103))
(define-constant err-invalid-bid (err u104))
(define-constant err-auction-ended (err u105))

;; Data Variables
(define-data-var next-npt-id uint u1)
(define-data-var next-auction-id uint u1)
(define-data-var marketplace-fee uint u10) ;; 10% fee

;; Data Maps
(define-map npts
  uint
  {
    owner: principal,
    name: (string-ascii 50),
    rarity: (string-ascii 20),
    emoji: (string-ascii 10),
    value: uint,
    created-at: uint
  }
)

(define-map marketplace-listings
  uint
  {
    npt-id: uint,
    seller: principal,
    price: uint,
    listed-at: uint
  }
)

(define-map auctions
  uint
  {
    npt-id: uint,
    seller: principal,
    current-bid: uint,
    highest-bidder: (optional principal),
    end-block: uint,
    active: bool
  }
)

(define-map user-npt-count principal uint)

;; Private Functions
(define-private (generate-rarity (mining-power uint))
  (let ((random-value (mod (+ block-height mining-power) u100)))
    (if (< random-value u5)
      "Legendary"
      (if (< random-value u25)
        "Rare"
        "Common"
      )
    )
  )
)

(define-private (generate-npt-value (rarity (string-ascii 20)) (mining-power uint))
  (if (is-eq rarity "Legendary")
    (+ u50 (mod mining-power u100))
    (if (is-eq rarity "Rare")
      (+ u15 (mod mining-power u35))
      (+ u3 (mod mining-power u12))
    )
  )
)

(define-private (generate-emoji (rarity (string-ascii 20)))
  (if (is-eq rarity "Legendary")
    "🌟"
    (if (is-eq rarity "Rare")
      "💎"
      "✨"
    )
  )
)

;; Public Functions

;; Mine a new NPT
(define-public (mine-npt (mining-power uint))
  (let (
    (npt-id (var-get next-npt-id))
    (rarity (generate-rarity mining-power))
    (value (generate-npt-value rarity mining-power))
    (emoji (generate-emoji rarity))
    (npt-name (concat "NPT #" (int-to-ascii (to-int npt-id))))
  )
    ;; Transfer STX from miner to contract
    (try! (stx-transfer? mining-power tx-sender (as-contract tx-sender)))
    
    ;; Create the NPT
    (map-set npts npt-id {
      owner: tx-sender,
      name: npt-name,
      rarity: rarity,
      emoji: emoji,
      value: value,
      created-at: block-height
    })
    
    ;; Update user NPT count
    (map-set user-npt-count tx-sender 
      (+ (default-to u0 (map-get? user-npt-count tx-sender)) u1))
    
    ;; Increment next NPT ID
    (var-set next-npt-id (+ npt-id u1))
    
    (ok npt-id)
  )
)

;; List NPT for sale
(define-public (list-npt-for-sale (npt-id uint) (price uint))
  (let ((npt (unwrap! (map-get? npts npt-id) err-not-found)))
    ;; Check if sender owns the NPT
    (asserts! (is-eq (get owner npt) tx-sender) err-unauthorized)
    
    ;; Create marketplace listing
    (map-set marketplace-listings npt-id {
      npt-id: npt-id,
      seller: tx-sender,
      price: price,
      listed-at: block-height
    })
    
    (ok true)
  )
)

;; Buy NPT from marketplace
(define-public (buy-npt (listing-id uint))
  (let (
    (listing (unwrap! (map-get? marketplace-listings listing-id) err-not-found))
    (npt (unwrap! (map-get? npts (get npt-id listing)) err-not-found))
    (price (get price listing))
    (seller (get seller listing))
    (fee (/ (* price (var-get marketplace-fee)) u100))
    (seller-amount (- price fee))
  )
    ;; Transfer STX from buyer to seller
    (try! (stx-transfer? seller-amount tx-sender seller))
    
    ;; Transfer fee to contract
    (try! (stx-transfer? fee tx-sender (as-contract tx-sender)))
    
    ;; Transfer NPT ownership
    (map-set npts (get npt-id listing) (merge npt {owner: tx-sender}))
    
    ;; Remove from marketplace
    (map-delete marketplace-listings listing-id)
    
    ;; Update user NPT counts
    (map-set user-npt-count seller 
      (- (default-to u1 (map-get? user-npt-count seller)) u1))
    (map-set user-npt-count tx-sender 
      (+ (default-to u0 (map-get? user-npt-count tx-sender)) u1))
    
    (ok true)
  )
)

;; Create auction
(define-public (create-auction (npt-id uint) (starting-bid uint) (duration uint))
  (let (
    (auction-id (var-get next-auction-id))
    (npt (unwrap! (map-get? npts npt-id) err-not-found))
    (end-block (+ block-height (* duration u144))) ;; Assuming ~10 min blocks, duration in hours
  )
    ;; Check if sender owns the NPT
    (asserts! (is-eq (get owner npt) tx-sender) err-unauthorized)
    
    ;; Create auction
    (map-set auctions auction-id {
      npt-id: npt-id,
      seller: tx-sender,
      current-bid: starting-bid,
      highest-bidder: none,
      end-block: end-block,
      active: true
    })
    
    ;; Increment next auction ID
    (var-set next-auction-id (+ auction-id u1))
    
    (ok auction-id)
  )
)

;; Place bid on auction
(define-public (place-bid (auction-id uint) (bid-amount uint))
  (let (
    (auction (unwrap! (map-get? auctions auction-id) err-not-found))
    (current-bid (get current-bid auction))
    (previous-bidder (get highest-bidder auction))
  )
    ;; Check if auction is still active
    (asserts! (get active auction) err-auction-ended)
    (asserts! (< block-height (get end-block auction)) err-auction-ended)
    
    ;; Check if bid is higher than current bid
    (asserts! (> bid-amount current-bid) err-invalid-bid)
    
    ;; Return funds to previous highest bidder
    (match previous-bidder
      prev-bidder (try! (as-contract (stx-transfer? current-bid tx-sender prev-bidder)))
      true
    )
    
    ;; Transfer new bid to contract
    (try! (stx-transfer? bid-amount tx-sender (as-contract tx-sender)))
    
    ;; Update auction
    (map-set auctions auction-id (merge auction {
      current-bid: bid-amount,
      highest-bidder: (some tx-sender)
    }))
    
    (ok true)
  )
)

;; End auction and transfer NPT
(define-public (end-auction (auction-id uint))
  (let (
    (auction (unwrap! (map-get? auctions auction-id) err-not-found))
    (npt (unwrap! (map-get? npts (get npt-id auction)) err-not-found))
    (seller (get seller auction))
    (final-bid (get current-bid auction))
    (winner (get highest-bidder auction))
    (fee (/ (* final-bid (var-get marketplace-fee)) u100))
    (seller-amount (- final-bid fee))
  )
    ;; Check if auction has ended
    (asserts! (>= block-height (get end-block auction)) err-auction-ended)
    (asserts! (get active auction) err-not-found)
    
    ;; Transfer NPT to winner if there was a bid
    (match winner
      bidder (begin
        ;; Transfer STX to seller
        (try! (as-contract (stx-transfer? seller-amount tx-sender seller)))
        
        ;; Transfer NPT to winner
        (map-set npts (get npt-id auction) (merge npt {owner: bidder}))
        
        ;; Update user NPT counts
        (map-set user-npt-count seller 
          (- (default-to u1 (map-get? user-npt-count seller)) u1))
        (map-set user-npt-count bidder 
          (+ (default-to u0 (map-get? user-npt-count bidder)) u1))
      )
      ;; No bids, return NPT to seller (no action needed)
      true
    )
    
    ;; Mark auction as inactive
    (map-set auctions auction-id (merge auction {active: false}))
    
    (ok true)
  )
)

;; Read-only functions

;; Get NPT details
(define-read-only (get-npt (npt-id uint))
  (map-get? npts npt-id)
)

;; Get user's NPTs
(define-read-only (get-user-npts (user principal))
  (let ((npt-count (default-to u0 (map-get? user-npt-count user))))
    ;; This is a simplified version - in practice, you'd want to maintain a list
    (ok npt-count)
  )
)

;; Get marketplace listings
(define-read-only (get-marketplace-items)
  ;; This would return active marketplace listings
  ;; Simplified for demo purposes
  (ok u0)
)

;; Get active auctions
(define-read-only (get-active-auctions)
  ;; This would return active auctions
  ;; Simplified for demo purposes
  (ok u0)
)

;; Get auction details
(define-read-only (get-auction (auction-id uint))
  (map-get? auctions auction-id)
)

;; Admin functions

;; Set marketplace fee (owner only)
(define-public (set-marketplace-fee (new-fee uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set marketplace-fee new-fee)
    (ok true)
  )
)

;; Withdraw contract balance (owner only)
(define-public (withdraw-balance (amount uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (try! (as-contract (stx-transfer? amount tx-sender contract-owner)))
    (ok true)
  )
)

Clarinet.toml (Project Configuration):

[project]
name = "npt-market"
description = "A decentralized marketplace for NPTs on Stacks"
authors = ["Your Name <your.email@example.com>"]
telemetry = false
cache_dir = "./.cache"
requirements = []

[contracts.npt-market]
path = "contracts/npt-market.clar"
clarity_version = 2
epoch = 2.4

[repl]
costs_version = 2
parser_version = 2

[[repl.sessions]]
name = "default"
start_commands = [
    "::get_contracts_info",
]

[networks]
simnet = "http://localhost:20443"
testnet = "https://stacks-node-api.testnet.stacks.co"
mainnet = "https://stacks-node-api.mainnet.stacks.co"

[accounts]
deployer = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
wallet_1 = "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5"
wallet_2 = "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG"

tests/npt-market_test.ts:

import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v1.0.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

Clarinet.test({
    name: "Can mine NPT",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const wallet1 = accounts.get('wallet_1')!;
        
        let block = chain.mineBlock([
            Tx.contractCall('npt-market', 'mine-npt', [types.uint(1000000)], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectOk(), types.uint(1));
    },
});

Clarinet.test({
    name: "Can list NPT for sale",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const wallet1 = accounts.get('wallet_1')!;
        
        // First mine an NPT
        let block = chain.mineBlock([
            Tx.contractCall('npt-market', 'mine-npt', [types.uint(1000000)], wallet1.address)
        ]);
        
        // Then list it for sale
        block = chain.mineBlock([
            Tx.contractCall('npt-market', 'list-npt-for-sale', [
                types.uint(1), 
                types.uint(5000000)
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectOk(), types.bool(true));
    },
});

Clarinet.test({
    name: "Can create auction",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const wallet1 = accounts.get('wallet_1')!;
        
        // First mine an NPT
        let block = chain.mineBlock([
            Tx.contractCall('npt-market', 'mine-npt', [types.uint(1000000)], wallet1.address)
        ]);
        
        // Then create auction
        block = chain.mineBlock([
            Tx.contractCall('npt-market', 'create-auction', [
                types.uint(1), 
                types.uint(2000000),
                types.uint(24)
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectOk(), types.uint(1));
    },
});