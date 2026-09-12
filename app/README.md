# TrustPort React Native App

Solana Mobile 可信联系人转账钱包应用。

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 生成 JS Bundle
npx react-native bundle --platform android --dev false --entry-file index.js \
  --bundle-output android/app/src/main/assets/index.android.bundle \
  --assets-dest android/app/src/main/res/

# 3. 构建 APK
cd android
java -Xmx2048m -classpath gradle/wrapper/gradle-wrapper.jar \
  org.gradle.wrapper.GradleWrapperMain assembleRelease

# 4. 安装到设备
adb install app/build/outputs/apk/release/app-release.apk
```

## 项目结构

```
app/
├── App.tsx                          # 入口文件 + 导航配置
├── src/
│   ├── screens/
│   │   ├── OnboardingScreen.tsx     # 钱包选择与首次连接
│   │   ├── HomeScreen.tsx           # 资产总览、代币列表、筛选、24h涨跌
│   │   ├── TransferScreen.tsx       # 转账（SOL/SPL）、扫码、MAX、Explorer
│   │   ├── TransactionHistoryScreen.tsx  # 链上交易记录 + solscan 链接
│   │   ├── NewRelationScreen.tsx    # 生成个人 QR 码 + 保存相册
│   │   ├── ConfirmRelationScreen.tsx # 扫码 + 口令验证建立关系
│   │   ├── ContactsScreen.tsx       # 可信联系人列表
│   │   └── SettingsScreen.tsx       # 网络信息、钱包状态
│   ├── hooks/
│   │   ├── useWallet.tsx            # 钱包连接（MWA/Seed Vault/本地）
│   │   └── useContacts.tsx          # 联系人 CRUD（AsyncStorage）
│   └── navigation/
│       └── types.ts                 # 导航类型定义
├── android/
│   └── app/src/main/java/com/trustport/
│       ├── QRScannerModule.java     # ZXing 扫码原生模块
│       ├── QRSaveModule.java        # QR 码保存相册原生模块
│       ├── WalletDiscoveryModule.java # MWA 钱包发现模块
│       └── MainActivity.java        # 主 Activity
└── package.json
```

## 页面功能

### HomeScreen（首页）
- 总资产 USD 估值（DexScreener + CoinGecko 双源价格）
- 代币列表（logo + 全名 + 余额 + 24h 涨跌）
- 资产筛选（隐藏小额、隐藏零余额、按价值排序）
- SOL 余额不足警告
- 6 宫格快捷操作

### TransferScreen（转账）
- SOL + SPL 代币转账
- 📷 扫码填地址（ZXing 原生模块）
- 👤 联系人选择器
- MAX 一键最大金额（SOL 保留 0.005 手续费）
- Solana Explorer 交易查看

### TransactionHistoryScreen（交易记录）
- 最近 50 笔交易，并行批量加载（3 个一批）
- 渐进式显示（每批完成后立即刷新列表）
- 点击跳转 solscan.io/tx/{signature}

### 联系人系统
- QR 码生成（react-native-qrcode-svg）+ 保存相册
- QR 码扫码确认（ZXing 原生模块）
- 口令验证 + 双向信任关系
- AsyncStorage 本地持久化

## 核心 Hooks

### useWallet
管理钱包连接，支持三种模式：
- **Phantom**: Mobile Wallet Adapter (MWA) 协议
- **Seed Vault**: Solana Seeker 内置密钥库
- **Local**: 本地密钥对（Demo 模式，无需外部钱包）

会话通过 AsyncStorage 持久化，重启后自动恢复。

### useContacts
联系人 CRUD 操作，数据存储在 AsyncStorage：
- `contacts`: 可信联系人列表
- `addContact(address, remark)`: 添加联系人
- `removeContact(address)`: 删除联系人

## 代币元数据

三级降级策略，最大化覆盖率：

1. **TOKEN_META 硬编码表**（14 种已知代币）— 即时显示
2. **Jupiter Token List** (`tokens.jup.ag`) — 在线查询 symbol/logo
3. **Metaplex 链上 Borsh 解析** — 最后兜底

完全无法解析的代币（名称为地址截断）被过滤不显示。

## 原生 Android 模块

| 模块 | 功能 | 依赖 |
|------|------|------|
| QRScannerModule | ZXing 全屏扫码 Activity | zxing-android-embedded |
| QRSaveModule | QR 码 Bitmap → MediaStore 保存 | Android MediaStore API |
| WalletDiscoveryModule | 检测设备上已安装的 MWA 钱包 | Android PackageManager |

## 网络配置

当前连接 **Solana 主网 (mainnet-beta)**。

RPC 端点配置在 `useWallet.tsx` 中，默认使用 `https://api.mainnet-beta.solana.com`。

## 开发环境

- Node.js: 24.x
- JDK: 17
- Android SDK: 34
- React Native: 0.73.4
- 目标设备: Solana Seeker (Samsung, Android 14)

## 已知问题

- 并行 RPC 请求 batch size > 3 时可能触发限流，交易记录加载已限制为 3 个一批
- CoinGecko 免费 API 有速率限制，高频请求时可能返回空数据，已设置安全网兜底价格
- DexScreener 对低流动性代币可能返回不准确价格，已知代币优先使用 symbol 查价避免误匹配
- Samsung Secure Folder (User 150) 中的旧版 APK 无法通过 adb 卸载，需手动清理
