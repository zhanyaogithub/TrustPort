# TrustPort - dApp Store 提交信息

> 本文档包含在 Solana dApp Store Publisher Portal 上创建应用列表时所需的全部信息。

## Publisher 信息

| 字段 | 值 |
|------|-----|
| Publisher Keypair | `/Users/zhanyao/.config/solana/trustport-publisher.json` |
| Publisher Pubkey | `4owS9JD1GPKpxPvM4eoeqSWbKcNJfCaKfEyZEZa1k9DL` |
| Publisher Name | TrustPort |
| Website | https://github.com/zhanyaogithub/TrustPort |
| Support Email | (填写你的邮箱) |

## App 基本信息

| 字段 | 值 |
|------|-----|
| App Name | TrustPort |
| Category | Finance / Wallet |
| Rating | Everyone |

### 短描述 (Short Description, ≤80字符)

```
Solana 可信联系人转账钱包，QR 码建立信任，多币种安全转账
```

### 长描述 (Long Description)

```
TrustPort 是一款专为 Solana Mobile 设计的转账钱包应用。

核心亮点：
• 可信联系人系统 — 通过 QR 码互扫 + 口令验证建立双向信任关系，让每一笔转账都有信任保障
• 多币种支持 — SOL 原生代币 + USDC、USDT、BONK 等 SPL 代币，一个钱包管理所有资产
• 智能资产展示 — 24h 涨跌幅实时显示，自动过滤垃圾空投币，资产一目了然
• 极致转账体验 — 扫码填地址、MAX 一键最大金额、交易记录直链 Solana Explorer
• 多钱包适配 — 支持 Phantom、Seed Vault、本地钱包，适配 Solana Seeker 手机

安全提醒：建议仅向可信联系人转账，避免被骗。

Built for Solana Mobile Hackathon 2026 "CLOCK IN"
```

### 功能标签 (Tags)

```
wallet, transfer, solana, qr-code, contacts, spl-tokens, mobile
```

## 素材要求

| 素材 | 规格 | 状态 |
|------|------|------|
| App Icon | 512x512 PNG | 待生成 |
| Feature Graphic | 1024x500 PNG | 待生成 |
| Screenshot 1 | 手机竖屏 (≥320px宽) | 待截取 |
| Screenshot 2 | 手机竖屏 | 待截取 |
| Screenshot 3 | 手机竖屏 | 待截取 |

### 建议截图内容

1. **首页资产总览** — 展示代币列表、24h 涨跌、总资产
2. **转账页面** — 展示扫码、MAX 按钮、币种选择
3. **QR 码建关系** — 展示分享二维码 / 扫码确认流程

## 发布命令

```bash
# 1. 确保 dapp-store CLI 已安装
npm install -g @solana-mobile/dapp-store-cli

# 2. 设置 Portal API Key（从 Publisher Portal 获取）
export DAPP_STORE_API_KEY="your-api-key-here"

# 3. 发布 APK
npx dapp-store \
  --apk-file /Users/zhanyao/Documents/Qoder/solana/apk/TrustPort-20260911-0919.apk \
  --whats-new "TrustPort v1.0 - 可信联系人转账钱包" \
  --keypair /Users/zhanyao/.config/solana/trustport-publisher.json \
  --verbose
```

## Publisher Portal 链接

- 注册/登录: https://dappstore.solanamobile.com
- 文档: https://docs.solanamobile.com/dapp-store/publishing

## 注意事项

1. Publisher 账户需要持有足够的 SOL 用于链上交易费（约 0.1 SOL）
2. dApp Store 审核通常需要 1-3 个工作日
3. 每次更新版本都需要通过 CLI 重新上传 APK
4. 隐私政策 URL 可以先用 GitHub README 链接，后续补完整页面
