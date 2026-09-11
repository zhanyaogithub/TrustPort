import {PublicKey} from '@solana/web3.js';

export const TOKEN_META: {[mint: string]: {symbol: string; name: string; decimals: number; logoURI: string}} = {
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': {symbol: 'USDC', name: 'USD Coin', decimals: 6, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png'},
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': {symbol: 'USDT', name: 'Tether USD', decimals: 6, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg'},
  'So11111111111111111111111111111111111111112': {symbol: 'WSOL', name: 'Wrapped SOL', decimals: 9, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png'},
  'mSoLzY6H4nc4n618KgvFMV7gEL437KbMKg6U3BjB3nK': {symbol: 'mSOL', name: 'Marinade Staked SOL', decimals: 9, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/mSoLzY6H4nc4n618KgvFMV7gEL437KbMKg6U3BjB3nK/logo.png'},
  '7dHbWXmci3dT8UFKYYZSSLaV8FzudSVL7kgB2xNgRPeA': {symbol: 'stSOL', name: 'Lido Staked SOL', decimals: 9, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/7dHbWXmci3dT8UFKYYZSSLaV8FzudSVL7kgB2xNgRPeA/logo.png'},
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': {symbol: 'BONK', name: 'Bonk', decimals: 5, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263/logo.png'},
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': {symbol: 'JUP', name: 'Jupiter', decimals: 6, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN/logo.png'},
  '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R': {symbol: 'RAY', name: 'Raydium', decimals: 6, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png'},
  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm': {symbol: 'WIF', name: 'dogwifhat', decimals: 6, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm/logo.png'},
  'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3': {symbol: 'PYTH', name: 'Pyth Network', decimals: 6, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3/logo.svg'},
  '21rweMLGYeMNonHW7H3xa5py17X6ZFRcHirCp9inRBQA': {symbol: 'IQ50', name: 'IQ50', decimals: 6, logoURI: ''},
  '7i5KKsQ2weiTkry7jA4ZwSuXGhs5eJBEjY8vVxR4pfT': {symbol: 'GMT', name: 'Green Metaverse Token', decimals: 8, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/7i5KKsQ2weiTkry7jA4ZwSuXGhs5eJBEjY8vVxR4pfT/logo.png'},
  'AFbX8oqjGPAh84PbD1BFoPZDT4zPb2eV2e3bQj6ZtEwG': {symbol: 'GST', name: 'Green Satoshi Token', decimals: 9, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/AFbX8oqjGPAh84PbD1BFoPZDT4zPb2eV2e3bQj6ZtEwG/logo.png'},
};

export async function resolveTokenMeta(mint: string, connection: any): Promise<{symbol: string; name: string; decimals: number; logoURI: string | null}> {
  // 1. Check hardcoded map
  if (TOKEN_META[mint]) {
    return {...TOKEN_META[mint]};
  }
  // 2. Try Jupiter token list
  try {
    const resp = await fetch(`https://tokens.jup.ag/token/${mint}`);
    if (resp.ok) {
      const data = await resp.json();
      if (data?.symbol && data?.decimals !== undefined) {
        return {
          symbol: data.symbol,
          name: data.name || data.symbol,
          decimals: data.decimals,
          logoURI: data.logoURI || null,
        };
      }
    }
  } catch (e) {}
  // 3. Try Metaplex on-chain metadata
  try {
    const [metadataPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('metadata'), new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s').toBuffer(), new PublicKey(mint).toBuffer()],
      new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'),
    );
    const info = await connection.getAccountInfo(metadataPda);
    if (info?.data && info.data.length > 100) {
      const buf = info.data;
      let off = 1 + 32 + 32; // key + update_authority + mint
      const readStr = (o: number) => {
        const len = buf.readUInt32LE(o);
        return {str: buf.slice(o + 4, o + 4 + len).toString('utf8').replace(/\0+$/, '').trim(), next: o + 4 + len};
      };
      const nameRes = readStr(off); off = nameRes.next;
      const symRes = readStr(off); off = symRes.next;
      const uriRes = readStr(off);
      return {symbol: symRes.str || mint.slice(0, 4), name: nameRes.str || mint.slice(0, 8), decimals: 9, logoURI: null};
    }
  } catch (e) {}
  return {symbol: mint.slice(0, 4) + '...', name: mint.slice(0, 8) + '...', decimals: 9, logoURI: null};
}
