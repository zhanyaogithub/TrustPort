# TrustPort Privacy Policy

**Last Updated: September 12, 2026**

## Introduction

TrustPort ("we", "our", or "the App") is a cryptocurrency wallet application built for Solana Mobile devices. This Privacy Policy explains how we handle information when you use our App.

## Information We Collect

### Information Stored Locally on Your Device

TrustPort stores the following information **only on your device** (local storage):

- **Wallet session data** — Your connected wallet's public address and session state, used to maintain your login across app restarts.
- **Trusted contacts** — Contact names, wallet addresses, and verification data created when you establish trust relationships via QR code scanning.
- **Transaction history cache** — A local cache of your recent transactions fetched from the Solana blockchain.

### Information Shared with Third-Party Services

TrustPort communicates with the following public services to provide core functionality:

- **Solana RPC (api.mainnet-beta.solana.com)** — To query your wallet balance, token accounts, and transaction history on the Solana blockchain. Only your public wallet address is sent.
- **CoinGecko API (api.coingecko.com)** — To fetch real-time cryptocurrency prices and 24-hour price changes. No personal data is sent.
- **DexScreener API (api.dexscreener.com)** — To fetch decentralized exchange token prices by mint address. No personal data is sent.
- **Jupiter Token List (tokens.jup.ag)** — To resolve SPL token metadata (name, symbol, logo). No personal data is sent.

### Information We Do NOT Collect

- We do **not** collect, store, or transmit your private keys or seed phrases.
- We do **not** collect your name, email, phone number, or any personally identifiable information.
- We do **not** use analytics, tracking, or advertising SDKs.
- We do **not** collect location data, biometric data, or any regulated data as defined by applicable privacy laws.
- We do **not** collect data from minors.

## Data Storage and Security

All user data is stored locally on your device using React Native AsyncStorage. Data is not transmitted to or stored on any server controlled by us. Your private keys remain within your device's hardware security module (Seed Vault) or your chosen wallet provider (e.g., Phantom).

## Data Deletion

Since all data is stored locally on your device, you can delete all TrustPort data by:
1. Uninstalling the App from your device, or
2. Clearing the App's data in your device's Settings → Apps → TrustPort → Clear Data.

## Children's Privacy

TrustPort does not knowingly collect information from children under the age of 18 (or the age of majority in your jurisdiction).

## Changes to This Policy

We may update this Privacy Policy from time to time. Changes will be posted to this page with an updated "Last Updated" date. Continued use of the App after changes constitutes acceptance.

## Contact

For questions about this Privacy Policy, please open an issue on our GitHub repository: https://github.com/zhanyaogithub/TrustPort
