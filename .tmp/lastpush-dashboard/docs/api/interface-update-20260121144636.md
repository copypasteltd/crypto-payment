# Interface Update 20260121144636

## New Endpoint

### POST /api/v1/billing/top-up/crypto/order

Creates a crypto top-up order and returns the payment instructions.
Supported chains/tokens:
- ETH: USDT, USDC
- BSC: USDT, USDC
- ARB: USDT, USDC
- POLYGON: USDC
- SOLANA: USDT, USDC
- TRX: USDT
- TON: USDT

Request (JSON)

```json
{
  "amount": 100,
  "chainId": 56,
  "token": "USDT"
}
```

Response 200

```json
{
  "orderId": "ord_123",
  "depositAddress": "0xabc...",
  "chainId": 56,
  "token": "USDT",
  "amount": 100
}
```
