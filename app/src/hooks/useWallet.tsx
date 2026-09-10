import React, {createContext, useContext, useState, useCallback, ReactNode, useEffect} from 'react';
import {transact} from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import {Connection, PublicKey, Transaction, Keypair} from '@solana/web3.js';
import * as bs58 from 'bs58';
import AsyncStorage from '@react-native-async-storage/async-storage';

const WALLET_SESSION_KEY = 'trustport_wallet_session';

interface WalletContextType {
  publicKey: PublicKey | null;
  connected: boolean;
  connecting: boolean;
  isLocalWallet: boolean;
  sessionRestored: boolean;
  connect: (targetPackage?: string) => Promise<void>;
  connectLocal: () => Promise<void>;
  disconnect: () => Promise<void>;
  signAndSendTransaction: (transaction: any) => Promise<string>;
  connection: Connection;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

// Solana Mainnet endpoint for production
const RPC_ENDPOINT = 'https://api.mainnet-beta.solana.com';
const connection = new Connection(RPC_ENDPOINT, 'confirmed');

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({children}: WalletProviderProps) {
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [isLocalWallet, setIsLocalWallet] = useState(false);
  const [localKeypair, setLocalKeypair] = useState<Keypair | null>(null);
  const [sessionRestored, setSessionRestored] = useState(false);
  const authTokenRef = React.useRef<string | null>(null);

  // Restore session on mount
  useEffect(() => {
    restoreSession();
  }, []);

  const restoreSession = async () => {
    try {
      const sessionData = await AsyncStorage.getItem(WALLET_SESSION_KEY);
      if (sessionData) {
        const {publicKey: pkStr, isLocal: isLocal, authToken} = JSON.parse(sessionData);
        console.log('[restoreSession] Found saved session:', pkStr, 'isLocal:', isLocal);
        setPublicKey(new PublicKey(pkStr));
        setConnected(true);
        setIsLocalWallet(isLocal);
        if (authToken) {
          authTokenRef.current = authToken;
        }
      } else {
        console.log('[restoreSession] No saved session found');
      }
    } catch (error: any) {
      console.error('[restoreSession] Failed to restore session:', error.message);
    } finally {
      setSessionRestored(true);
    }
  };

  const saveSession = async (pk: PublicKey, isLocal: boolean, authToken?: string) => {
    try {
      const sessionData = JSON.stringify({publicKey: pk.toBase58(), isLocal, authToken: authToken || authTokenRef.current});
      await AsyncStorage.setItem(WALLET_SESSION_KEY, sessionData);
      console.log('[saveSession] Session saved:', pk.toBase58());
    } catch (error: any) {
      console.error('[saveSession] Failed to save session:', error.message);
    }
  };

  const clearSession = async () => {
    try {
      authTokenRef.current = null;
      await AsyncStorage.removeItem(WALLET_SESSION_KEY);
      console.log('[clearSession] Session cleared');
    } catch (error: any) {
      console.error('[clearSession] Failed to clear session:', error.message);
    }
  };

  const connect = useCallback(async (targetPackage?: string) => {
    console.log('[connect] Starting MWA connection...', targetPackage ? `targeting: ${targetPackage}` : '(no target)');
    setConnecting(true);
    setIsLocalWallet(false);

    try {
      console.log('[connect] Entering transact...');

      // Build config with optional targetPackage for wallet targeting
      const config: any = {};
      if (targetPackage) {
        config.targetPackage = targetPackage;
        console.log('[connect] Config targeting:', targetPackage);
      }

      // Note: No JS-side timeout. React Native JS timers are paused when app
      // goes to background (to open wallet), causing delayed firing and race
      // conditions with the native MWA session. The native MWA library handles
      // timeouts internally via ASSOCIATION_TIMEOUT_MS.
      await transact(async (walletApi) => {
        console.log('[connect] walletApi received:', walletApi ? 'yes' : 'no');
        console.log('[connect] walletApi methods:', Object.keys(walletApi || {}).join(', '));
        console.log('[connect] Calling walletApi.authorize with params:', JSON.stringify({
          cluster: 'mainnet-beta',
          identity: {name: 'TrustPort', uri: 'https://github.com/zhanyaogithub/TrustPort'},
        }));

        try {
          const authResult = await walletApi.authorize({
            cluster: 'mainnet-beta',
            identity: {
              name: 'TrustPort',
              uri: 'https://github.com/zhanyaogithub/TrustPort',
            },
          });

          console.log('[connect] Authorization succeeded, result type:', typeof authResult);
          console.log('[connect] Authorization result keys:', authResult ? Object.keys(authResult).join(', ') : 'null');
          
          if (authResult.accounts && authResult.accounts.length > 0) {
            const account = authResult.accounts[0];
            console.log('[connect] Raw account address:', account.address);
            console.log('[connect] Account label:', account.label);
            
            // MWA may return address in different formats (base64 or base58)
            let publicKeyStr = account.address;
            
            // Check if it's base64 (contains '=' or invalid base58 chars)
            if (publicKeyStr.includes('=') || /[^1-9A-HJ-NP-Za-km-z]/.test(publicKeyStr)) {
              console.log('[connect] Detected non-base58 address, attempting conversion...');
              console.log('[connect] Original address:', account.address);
              try {
                // Step 1: Decode base64 to bytes using pure JS (no atob/Buffer)
                const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
                const paddedStr = publicKeyStr.replace(/-/g, '+').replace(/_/g, '/');
                const byteNumbers: number[] = [];
                
                for (let i = 0; i < paddedStr.length; i += 4) {
                  const b0 = base64Chars.indexOf(paddedStr[i]);
                  const b1 = base64Chars.indexOf(paddedStr[i + 1]);
                  const b2 = base64Chars.indexOf(paddedStr[i + 2]);
                  const b3 = base64Chars.indexOf(paddedStr[i + 3]);
                  
                  if (b0 !== -1 && b1 !== -1) {
                    byteNumbers.push((b0 << 2) | (b1 >> 4));
                  }
                  if (b2 !== -1) {
                    byteNumbers.push(((b1 & 0x0F) << 4) | (b2 >> 2));
                  }
                  if (b3 !== -1) {
                    byteNumbers.push(((b2 & 0x03) << 6) | b3);
                  }
                }
                
                const byteArray = new Uint8Array(byteNumbers);
                console.log('[connect] Decoded bytes length:', byteArray.length);
                
                // Step 2: Convert bytes to base58 manually (no bs58 library)
                const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
                const zeros = Array.from(byteArray).findIndex(b => b !== 0);
                let result = BASE58_ALPHABET[0].repeat(zeros);
                
                // Convert byte array to big integer
                let num = BigInt('0x' + Array.from(byteArray).map(b => b.toString(16).padStart(2, '0')).join(''));
                
                // Encode to base58
                while (num > 0n) {
                  const remainder = Number(num % 58n);
                  result += BASE58_ALPHABET[remainder];
                  num = num / 58n;
                }
                
                // Reverse the string
                publicKeyStr = result.split('').reverse().join('');
                console.log('[connect] Converted to base58:', publicKeyStr);
              } catch (convertError: any) {
                console.error('[connect] Failed to convert address:', convertError.message);
                console.error('[connect] Original address:', account.address);
                throw new Error(`Invalid address format: ${convertError.message}`);
              }
            }
            
            const pk = new PublicKey(publicKeyStr);
            setPublicKey(pk);
            setConnected(true);
            
            // Save auth_token for future reauthorize() calls
            const authToken = authResult.auth_token || null;
            authTokenRef.current = authToken;
            console.log('[connect] Auth token saved:', authToken ? 'yes' : 'null');
            
            await saveSession(pk, false, authToken);
            console.log('[connect] Connection successful with address:', pk.toBase58());
          } else {
            console.error('[connect] No accounts in authResult');
            throw new Error('No accounts returned from wallet');
          }
        } catch (authorizeError: any) {
          console.error('[connect] authorize() threw error:', authorizeError.message);
          console.error('[connect] authorize error stack:', authorizeError.stack);
          throw authorizeError;
        }
      }, Object.keys(config).length > 0 ? config : undefined);

      console.log('[connect] Transact completed successfully');
    } catch (error: any) {
      console.error('[connect] Failed:', error.message);
      console.error('[connect] Error name:', error.name);
      console.error('[connect] Error stack:', error.stack);
      console.error('[connect] Error code:', error.code);
      throw error;
    } finally {
      setConnecting(false);
    }
  }, []);

  const connectLocal = useCallback(async () => {
    console.log('[connectLocal] Starting local wallet creation...');
    setConnecting(true);
    setIsLocalWallet(true);
    try {
      // Generate a new random keypair for demo
      console.log('[connectLocal] Generating keypair...');
      const kp = Keypair.generate();
      console.log('[connectLocal] Keypair generated:', kp.publicKey.toBase58());
      setLocalKeypair(kp);
      setPublicKey(kp.publicKey);
      setConnected(true);
      await saveSession(kp.publicKey, true);
      console.log('[connectLocal] Local wallet ready');
    } catch (error: any) {
      console.error('[connectLocal] Failed:', error.message, error.stack);
      throw error;
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (!isLocalWallet) {
      try {
        await transact(async (walletApi) => {
          await walletApi.deauthorize({auth_token: ''});
        });
      } catch (error) {
        console.error('Disconnect error:', error);
      }
    }
    await clearSession();
    setPublicKey(null);
    setConnected(false);
    setIsLocalWallet(false);
    setLocalKeypair(null);
  }, [isLocalWallet]);

  const signAndSendTransaction = useCallback(
    async (transaction: Transaction): Promise<string> => {
      if (!publicKey) {
        throw new Error('Wallet not connected');
      }

      // Local wallet: sign and send directly
      if (isLocalWallet && localKeypair) {
        transaction.partialSign(localKeypair);
        const signature = await connection.sendRawTransaction(
          transaction.serialize(),
          {preflightCommitment: 'confirmed'},
        );
        await connection.confirmTransaction(signature, 'confirmed');
        return signature;
      }

      // MWA wallet: use wallet adapter with reauthorize
      try {
        const signatures = await transact(async (walletApi) => {
          // Each transact() creates a new session - must reauthorize first
          if (authTokenRef.current) {
            try {
              console.log('[signAndSend] Reauthorizing with saved auth_token...');
              const reauthResult = await walletApi.reauthorize({
                auth_token: authTokenRef.current,
              });
              // Update auth_token if a new one was issued
              if (reauthResult.auth_token) {
                authTokenRef.current = reauthResult.auth_token;
                await saveSession(publicKey, false, reauthResult.auth_token);
              }
              console.log('[signAndSend] Reauthorize succeeded');
            } catch (reauthError: any) {
              console.warn('[signAndSend] Reauthorize failed, trying full authorize:', reauthError.message);
              // Fall back to full authorize
              const authResult = await walletApi.authorize({
                cluster: 'mainnet-beta',
                identity: {
                  name: 'TrustPort',
                  uri: 'https://github.com/zhanyaogithub/TrustPort',
                },
              });
              if (authResult.auth_token) {
                authTokenRef.current = authResult.auth_token;
                await saveSession(publicKey, false, authResult.auth_token);
              }
            }
          } else {
            // No saved token, do full authorize
            console.log('[signAndSend] No auth_token, doing full authorize...');
            const authResult = await walletApi.authorize({
              cluster: 'mainnet-beta',
              identity: {
                name: 'TrustPort',
                uri: 'https://github.com/zhanyaogithub/TrustPort',
              },
            });
            if (authResult.auth_token) {
              authTokenRef.current = authResult.auth_token;
              await saveSession(publicKey, false, authResult.auth_token);
            }
          }

          const result = await walletApi.signAndSendTransactions({
            transactions: [transaction],
          });
          return result;
        });
        return Array.isArray(signatures) ? signatures[0] : signatures;
      } catch (error) {
        console.error('Transaction failed:', error);
        throw error;
      }
    },
    [publicKey, isLocalWallet, localKeypair],
  );

  const value: WalletContextType = {
    publicKey,
    connected,
    connecting,
    isLocalWallet,
    sessionRestored,
    connect,
    connectLocal,
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
