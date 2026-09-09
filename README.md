# TrustPort - 双向可信关系转账钱包

> Solana Mobile Hackathon 2026 参赛项目

## 项目简介

TrustPort 是一款基于 Solana 的双向可信关系转账钱包。用户只能向已建立"可信关系"的人转账 SOL，通过离线密码短语哈希验证建立信任关系，防止误转账。

## 核心特性

- **可信关系验证**：通过离线密码短语哈希建立双向信任
- **受保护转账**：仅在 Active 状态下允许转账
- **Mobile Wallet Adapter**：原生集成 Seeker 手机钱包
- **链上安全保障**：PDA 存储关系状态，透明可验证

## 技术架构

### 智能合约
- **框架**：Anchor 0.32.1
- **语言**：Rust
- **Program ID**：`5qYmGbKTXkd9KRAbJYtPwGsqsYwHRjCseRzNPSGySztp`
- **指令**：
  - `init_relationship` - 初始化可信关系
  - `confirm_relationship` - 确认可信关系
  - `revoke_relationship` - 撤销可信关系
  - `guarded_transfer` - 受保护转账

### 前端
- **框架**：React Native 0.73.4
- **钱包连接**：Mobile Wallet Adapter (MWA)
- **Solana SDK**：@solana/web3.js
- **导航**：React Navigation

## 项目结构

```
TrustPort/
├── programs/
│   └── trustport/
│       └── src/
│           └── lib.rs              # 智能合约
├── app/
│   └── src/
│       ├── screens/                # 页面组件
│       ├── hooks/                  # 自定义 Hooks
│       └── navigation/             # 导航配置
├── tests/                          # 合约测试
├── Anchor.toml                     # Anchor 配置
└── package.json                    # 依赖管理
```

## 开发环境

- Node.js: 24.21.0
- Solana CLI: 4.2.2
- Rust: 1.98.1
- Anchor: 0.32.1

## 快速开始

```bash
# 安装依赖
npm install

# 构建合约
anchor build

# 运行测试
anchor test

# 部署到 Devnet
anchor deploy --provider.cluster devnet
```

## 开发计划

- [x] 项目初始化
- [x] 智能合约开发
- [ ] 合约测试
- [ ] React Native 前端
- [ ] Devnet 部署
- [ ] dApp Store 发布

## 许可证

MIT

## 团队

- 开发者：单人开发者
- 活动：Solana Mobile Hackathon "CLOCK IN"
- 时间：2026年9月 - 10月
