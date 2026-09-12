# TrustPort - 可信联系人转账钱包

> Solana Mobile Hackathon 2026 "CLOCK IN" 参赛项目

## 项目简介

TrustPort 是一款基于 Solana Mobile 的转账钱包应用，专为 Solana Seeker 手机设计。通过 QR 码互扫建立可信联系人关系，支持 SOL 和 SPL 代币转账，并提供友好的资产管理体验。

## 核心特性

- **可信联系人系统**：通过 QR 码互扫 + 口令验证建立双向信任关系，联系人存储在设备本地
- **多币种支持**：SOL 原生代币 + SPL 代币（USDC、USDT、BONK 等 13+ 种已知代币）
- **多钱包适配**：支持 Phantom（MWA）、Seed Vault、本地钱包三种模式
- **资产智能展示**：DexScreener + CoinGecko 双源价格、Metaplex 链上元数据解析，24h 涨跌幅显示，资产筛选过滤
- **转账体验优化**：扫码填地址、MAX 一键最大金额、Solana Explorer 交易查看
- **原生 QR 能力**：ZXing 扫码引擎、QR 码生成与相册保存

## 技术架构

### 前端（React Native）
- **框架**：React Native 0.73.4 + TypeScript
- **钱包连接**：@solana-mobile/mobile-wallet-adapter
- **Solana SDK**：@solana/web3.js + @solana/spl-token
- **代币元数据**：TOKEN_META 硬编码 + Jupiter Token List API + Metaplex 链上 Borsh 解析（三级降级策略）
- **价格数据**：DexScreener Batch API + CoinGecko simple/price（双源并行，含 24h 涨跌幅）
- **导航**：React Navigation v6
- **本地存储**：@react-native-async-storage/async-storage
- **QR 码**：react-native-qrcode-svg（生成）+ ZXing Android Native Module（扫码）

### 智能合约（Anchor）
- **框架**：Anchor 0.32.1
- **Program ID**：`5qYmGbKTXkd9KRAbJYtPwGsqsYwHRjCseRzNPSGySztp`
- **网络**：Devnet（已部署）
- **说明**：合约保留了可信关系初始化和受保护转账的链上逻辑，当前版本的关系系统以 QR 码 + 本地存储为主

### 原生模块（Android/Java）
- **QRScannerModule**：基于 ZXing 的全屏扫码 Activity
- **QRSaveModule**：QR 码生成并保存到相册（MediaStore API）
- **WalletDiscoveryModule**：MWA 钱包发现与检测

## 项目结构

```
TrustPort/
├── programs/trustport/src/lib.rs     # Solana 智能合约 (Rust/Anchor)
├── tests/                            # 合约测试
├── app/
│   ├── src/
│   │   ├── screens/                  # 页面组件（8 个屏幕）
│   │   ├── hooks/                    # 自定义 Hooks（useWallet, useContacts）
│   │   └── navigation/               # 导航配置
│   └── android/
│       └── app/src/main/java/com/trustport/  # 原生 Android 模块
├── Anchor.toml                       # Anchor 配置
└── BUILD_STATUS.md                   # 开发进度文档
```

## 页面概览

| 页面 | 功能 |
|------|------|
| HomeScreen | 资产总览、代币列表、24h 涨跌、筛选过滤、快捷操作入口 |
| TransferScreen | 转账（SOL/SPL）、扫码填地址、MAX 按钮、联系人选择、Explorer 链接 |
| TransactionHistoryScreen | 链上交易记录、可点击跳转 solscan.io |
| NewRelationScreen | 生成个人 QR 码、保存到相册、分享给联系人 |
| ConfirmRelationScreen | 扫码验证、口令确认、建立双向信任关系 |
| ContactsScreen | 可信联系人列表管理 |
| SettingsScreen | 网络信息、钱包状态、断开连接 |
| OnboardingScreen | 钱包选择与首次连接引导 |

## 开发环境

- Node.js: 24.21.0
- Solana CLI: 4.2.2
- Rust: 1.98.1
- Anchor: 0.32.1
- JDK: 17
- Android SDK: 34
- 目标设备：Solana Seeker (Samsung)

## 快速开始

```bash
# 安装依赖
cd app && npm install

# 生成 JS Bundle
npx react-native bundle --platform android --dev false --entry-file index.js \
  --bundle-output android/app/src/main/assets/index.android.bundle \
  --assets-dest android/app/src/main/res/

# 构建 APK
cd android && ./gradlew assembleRelease

# 安装到设备
adb install app/build/outputs/apk/release/app-release.apk
```

## 开发进度

- [x] 项目初始化与合约开发
- [x] React Native 前端（8 个页面）
- [x] 多钱包适配（Phantom / Seed Vault / 本地）
- [x] QR 码可信联系人系统
- [x] 多币种资产管理与转账
- [x] 原生 Android 模块（扫码、相册保存）
- [x] APK 构建与 Seeker 设备部署
- [x] 价格数据优化（DexScreener 批量查询 + 单遍架构）
- [x] dApp Store 素材准备（Icon、Banner、Graphic）
- [ ] dApp Store 上架审核
- [ ] Demo 视频录制
- [ ] Pitch Deck 制作

## 许可证

MIT

## 团队

- 单人开发者
- Solana Mobile Hackathon "CLOCK IN" 2026
