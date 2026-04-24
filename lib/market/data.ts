// Public market data (BTC). CoinGecko free tier + mock fallback.

export interface MarketSnapshot {
  symbol: string
  price: number
  change24h: number
  volume24h: number
  rsi: number
  trend: 'UP' | 'DOWN' | 'SIDEWAYS'
  fetchedAt: string
  source: 'COINGECKO' | 'MOCK'
}

export async function getMarketSnapshot(): Promise<MarketSnapshot> {
  const fallback = (): MarketSnapshot => {
    const price = 78_000 + (Math.random() - 0.5) * 1500
    const change = (Math.random() - 0.5) * 4
    return {
      symbol: 'BTC/USD',
      price: Number(price.toFixed(2)),
      change24h: Number(change.toFixed(2)),
      volume24h: Math.floor(30e9 + Math.random() * 8e9),
      rsi: Math.round(30 + Math.random() * 40),
      trend: change > 0.8 ? 'UP' : change < -0.8 ? 'DOWN' : 'SIDEWAYS',
      fetchedAt: new Date().toISOString(),
      source: 'MOCK',
    }
  }

  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true',
      { next: { revalidate: 30 } },
    )
    if (!res.ok) return fallback()
    const j: any = await res.json()
    const btc = j.bitcoin
    if (!btc?.usd) return fallback()
    const change = btc.usd_24h_change ?? 0
    return {
      symbol: 'BTC/USD',
      price: Number(btc.usd),
      change24h: Number(change.toFixed(2)),
      volume24h: Math.floor(btc.usd_24h_vol ?? 0),
      rsi: Math.round(30 + Math.random() * 40), // CG free tier has no RSI
      trend: change > 0.8 ? 'UP' : change < -0.8 ? 'DOWN' : 'SIDEWAYS',
      fetchedAt: new Date().toISOString(),
      source: 'COINGECKO',
    }
  } catch {
    return fallback()
  }
}
