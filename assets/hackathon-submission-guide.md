## Solana Mobile Hackathon "CLOCK IN" 提交表单速查表

> 提交截止：2026年10月8日
> 赛道：CLOCK IN（Solana Mobile 应用开发）

---

### 基本信息

**Project Name**
```
TrustPort
```

**Short Description**（一句话介绍）
```
A secure crypto wallet for Solana Mobile that uses QR code trust relationships to eliminate address-copying errors.
```

**Description**（项目描述）
```
TrustPort is a crypto wallet built natively for Solana Mobile's Seeker device. It solves the #1 pain point in crypto transfers — sending funds to the wrong address — by introducing a trust relationship system based on QR code scanning and passphrase verification.

Key features:
- Trust Contacts: Build verified relationships by scanning QR codes in person. Both parties authenticate each other through a shared passphrase, then transfer crypto by name instead of address.
- Multi-currency support: SOL, USDC, USDT, BONK, JUP, RAY and 8+ other SPL tokens with real-time 24h price changes.
- Smart asset display: Auto-filters spam airdrops, shows only legitimate tokens.
- Transfer UX: QR code address filling, MAX button for full balance, Solana Explorer integration.
- Multi-wallet: Supports Phantom, Seed Vault, and local wallet on Solana Seeker.

Tech stack: React Native 0.73.4 + TypeScript, native Android modules (ZXing QR scanner), Solana Web3.js, CoinGecko API, Jupiter token metadata, Metaplex on-chain metadata parsing.

Built for Solana Mobile Hackathon 2026 "CLOCK IN".
```

**Track / Category**
```
CLOCK IN
```

---

### 链接

**GitHub Repository**
```
https://github.com/zhanyaogithub/TrustPort
```

**Demo Video**（录制后填入）
```
(YouTube/Vimeo 链接，设为 Unlisted)
```

**dApp Store Listing**（审核通过后填入）
```
(审核通过后的 dApp Store 链接)
```

**App Website**
```
https://github.com/zhanyaogithub/TrustPort
```

**Pitch Deck**（如需上传链接）
```
(上传文件或提供 Google Drive/Dropbox 链接)
```

---

### 技术信息

**Tech Stack**
```
React Native, TypeScript, Solana Web3.js, Android Native Modules (Java/ZXing), CoinGecko API, Jupiter API, Metaplex
```

**Platform**
```
Solana Mobile (Seeker / Android)
```

**Solana Integration**
```
- Solana mainnet RPC for balance queries and SPL token transfers
- SystemProgram.transfer for SOL transfers
- SPL Token program for token transfers
- Metaplex on-chain metadata (Borsh deserialization) for token discovery
- Jupiter API for token metadata fallback
- Seed Vault / MWA wallet integration for transaction signing
```

**Open Source**
```
Yes - MIT License
```

---

### 团队信息

**Team Size**
```
1
```

**Team Members**
```
yao zhan (zhanyaogithub)
```

**Contact Email**
```
(填写你的邮箱)
```

---

### 补充说明字段（如有）

```
TrustPort leverages Solana Mobile's unique hardware capabilities (Seed Vault, native camera for QR scanning) to create a wallet experience that's both more secure and more user-friendly than traditional crypto wallets. The trust relationship system is a novel approach that could be adopted by other Solana Mobile apps. The app is published on the Solana dApp Store for Seeker devices.
```

---

### 提交前 Checklist

- [ ] Demo 视频录制完成（≤3分钟），上传到 YouTube/Vimeo
- [ ] Pitch Deck 可访问（文件或链接）
- [ ] GitHub 仓库整洁，所有代码已 push
- [ ] dApp Store 审核通过（或至少已提交）
- [ ] 提交表单所有字段填写完毕
- [ ] 在10月8日截止前提交
