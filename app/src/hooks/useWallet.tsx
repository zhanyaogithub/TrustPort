import React, {createContext, useContext, useState, useCallback, ReactNode} from 'react';
import {
  transact,
  Web3MobileWallet,
  AuthorizationResult,
  AuthorizeAPI,
  TransactAPI,
} from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import {Connection, PublicKey} from '@solana/web3.js';

interface WalletContextType {
  publicKey: PublicKey | null;
  connected: boolean;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signAndSendTransaction: (transaction: any) => Promise<string>;
  connection: Connection;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

// Devnet connection
const RPC_ENDPOINT = 'https://api.devnet.solana.com';
const connection = new Connection(RPC_ENDPOINT, 'confirmed');

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({children}: WalletProviderProps) {
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [wallet, setWallet] = useState<Web3MobileWallet | null>(null);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      await transact(async (api: AuthorizeAPI & TransactAPI) => {
        const authResult = await api.authorize({
          cluster: 'devnet',
          identity: {
            name: 'TrustPort',
            uri: 'https://trustport.app',
            icon: 'icon.png',
          },
        });

        if (authResult.accounts && authResult.accounts.length > 0) {
          const account = authResult.accounts[0];
          const pk = new PublicKey(account.address);
          setPublicKey(pk);
          setConnected(true);
          setWallet(api as unknown as Web3MobileWallet);
        }
      });
    } catch (error) {
      console.error('Wallet connection failed:', error);
      throw error;
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (wallet) {
      try {
        await transact(async (api: AuthorizeAPI & TransactAPI) => {
          await api.deauthorize({auth_token: ''});
        });
      } catch (error) {
        console.error('Disconnect error:', error);
      }
    }
    setPublicKey(null);
    setConnected(false);
    setWallet(null);
  }, [wallet]);

  const signAndSendTransaction = useCallback(
    async (transaction: any): Promise<string> => {
      if (!wallet || !publicKey) {
        throw new Error('Wallet not connected');
      }

      try {
        const result = await transact(async (api: AuthorizeAPI & TransactAPI) => {
          const signedTransactions = await api.signAndSendTransactions({
            transactions: [transaction],
          });
          return signedTransactions.signatures[0];
        });
        return result;
      } catch (error) {
        console.error('Transaction failed:', error);
        throw error;
      }
    },
    [wallet, publicKey],
  );

  const value: WalletContextType = {
    publicKey,
    connected,
    connecting,
    connect,
    disconnect,
    signAndSendTransaction,
    connection,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
