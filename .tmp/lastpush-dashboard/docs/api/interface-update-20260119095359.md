# Interface Update 20260119095359

## New Endpoints

### POST /api/v1/billing/top-up/crypto/init

Request a deposit address and token metadata for a chain-specific USDT top-up.

Request (JSON)

```json
{
  "amount": 50,
  "chainId": 56,
  "token": "USDT"
}
```

Response 200

```json
{
  "paymentId": "pay_123",
  "depositAddress": "0xDepositAddress",
  "tokenAddress": "0xUsdtAddress",
  "decimals": 6
}
```

### POST /api/v1/billing/top-up/crypto/confirm

Confirm a USDT transfer by submitting the signed payload and transaction hash.

Request (JSON)

```json
{
  "paymentId": "pay_123",
  "chainId": 56,
  "from": "0xUser",
  "to": "0xDepositAddress",
  "tokenAddress": "0xUsdtAddress",
  "amount": 50,
  "txHash": "0xTxHash",
  "signature": "0xSignature",
  "message": "LastPush TopUp\n..."
}
```

Response 200

```json
{
  "status": "PENDING"
}
```

## Notes

- Supported chains: BSC (56), POLYGON (137), BASE (8453).
- USDT decimals must be returned per chain.
- The backend should validate the signature against the `message` payload.
