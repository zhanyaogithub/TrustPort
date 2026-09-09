# TrustPort React Native App

## 安装依赖

```bash
cd app
npm install
```

## 运行

### Android
```bash
npm run android
```

### iOS
```bash
npm run ios
```

## 项目结构

```
app/
├── src/
│   ├── screens/          # 页面组件
│   │   ├── OnboardingScreen.tsx
│   │   ├── HomeScreen.tsx
│   │   ├── ContactsScreen.tsx
│   │   ├── NewRelationScreen.tsx
│   │   ├── TransferScreen.tsx
│   │   ├── TransactionHistoryScreen.tsx
│   │   └── SettingsScreen.tsx
│   ├── hooks/            # 自定义 Hooks
│   │   └── useWallet.tsx # MWA 钱包连接
│   ├── services/         # 服务层（待实现）
│   ├── utils/            # 工具函数（待实现）
│   └── navigation/       # 导航配置
│       └── types.ts
├── App.tsx               # 入口文件
└── package.json
```

## 核心功能

- **MWA 钱包连接**: 通过 Mobile Wallet Adapter 连接 Seeker 手机钱包
- **可信关系管理**: 创建/确认/撤销可信关系
- **受保护转账**: 仅向可信联系人转账
- **交易历史**: 查看链上交易记录

## 注意事项

1. 需要使用 Seeker 手机或支持 MWA 的钱包
2. 当前配置为 Devnet 网络
3. 智能合约需要先部署才能正常使用
