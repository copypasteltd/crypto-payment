# API Specification

This document defines the complete API surface required by the current UI flows. All paths are prefixed by `/api/v1`.

Conventions

- Auth via `Authorization: Bearer <token>` for all protected endpoints.
- All timestamps are ISO 8601 strings.
- All money amounts are in USD unless specified, as decimal numbers.
- Errors use a consistent envelope:

```json
{
  "error": {
    "code": "string",
    "message": "string",
    "details": {}
  }
}
```

## Auth

### POST /api/v1/auth/login/email

Request (JSON)

```json
{
  "email": "user@yourdomain.com",
  "redirect": "/dashboard"
}
```

Response 200

```json
{
  "status": "SENT",
  "challengeId": "chl_123",
  "expiresAt": "2026-01-14T12:00:00Z"
}
```

### POST /api/v1/auth/login/email/verify

Request (JSON)

```json
{
  "challengeId": "chl_123",
  "code": "123456"
}
```

Response 200

```json
{
  "token": "jwt_or_session_token",
  "user": {
    "id": "usr_123",
    "email": "user@yourdomain.com",
    "handle": "dev",
    "balance": 100.0
  }
}
```

### POST /api/v1/auth/login/wallet/nonce

Request (JSON)

```json
{
  "address": "0xabc...",
  "chainId": 1
}
```

Response 200

```json
{
  "nonce": "Login to LastPush: 123456",
  "expiresAt": "2026-01-14T12:00:00Z"
}
```

### POST /api/v1/auth/login/wallet/verify

Request (JSON)

```json
{
  "address": "0xabc...",
  "signature": "0xsignature",
  "nonce": "Login to LastPush: 123456"
}
```

Response 200

```json
{
  "token": "jwt_or_session_token",
  "user": {
    "id": "usr_123",
    "walletAddress": "0xabc...",
    "handle": "0xabc",
    "balance": 100.0
  }
}
```

### POST /api/v1/auth/logout

Response 204 (no body)

## Users

### GET /api/v1/users/me

Response 200

```json
{
  "id": "usr_123",
  "email": "user@yourdomain.com",
  "walletAddress": "0xabc...",
  "handle": "dev",
  "avatar": "https://...",
  "balance": 100.0
}
```

### PATCH /api/v1/users/me

Request (JSON)

```json
{
  "handle": "newhandle",
  "email": "user@yourdomain.com",
  "avatar": "https://..."
}
```

Response 200

```json
{
  "id": "usr_123",
  "email": "user@yourdomain.com",
  "handle": "newhandle",
  "avatar": "https://...",
  "balance": 100.0
}
```

## Domains

### GET /api/v1/domains/search

Query params

- `q` (string, required) search term
- `limit` (int, default 10)

Response 200

```json
{
  "query": "project",
  "results": [
    {
      "name": "project.com",
      "status": "AVAILABLE",
      "price": 12.99,
      "renewalPrice": 14.99
    }
  ]
}
```

### GET /api/v1/domains

Query params

- `page` (int, default 1)
- `pageSize` (int, default 20)
- `status` (ACTIVE|EXPIRED|PENDING, optional)

Response 200

```json
{
  "items": [
    {
      "name": "your-domain.tld",
      "registrarStatus": "Ok",
      "autoRenew": true,
      "expiresAt": "2025-11-24",
      "dnsMode": "MANUAL",
      "sslStatus": "ACTIVE"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 1
}
```

### GET /api/v1/domains/{name}

Response 200

```json
{
  "name": "your-domain.tld",
  "registrarStatus": "Ok",
  "autoRenew": true,
  "expiresAt": "2025-11-24",
  "dnsMode": "MANUAL",
  "sslStatus": "ACTIVE",
  "records": [
    {
      "id": "rec_1",
      "type": "A",
      "name": "@",
      "content": "76.76.21.21",
      "ttl": 60,
      "proxied": true
    }
  ]
}
```

### POST /api/v1/domains

Request (JSON)

```json
{
  "name": "your-domain.tld",
  "years": 1,
  "autoRenew": true,
  "privacyProtection": true
}
```

Response 201

```json
{
  "orderId": "ord_123",
  "status": "PENDING_PAYMENT"
}
```

### POST /api/v1/domains/connect

Request (JSON)

```json
{
  "name": "your-domain.tld",
  "registrar": "namecheap",
  "authCode": "transfer-code"
}
```

Response 202

```json
{
  "transferId": "trf_123",
  "status": "PENDING"
}
```

### PATCH /api/v1/domains/{name}/auto-renew

Request (JSON)

```json
{
  "enabled": true
}
```

Response 200

```json
{
  "name": "your-domain.tld",
  "autoRenew": true
}
```

### PATCH /api/v1/domains/{name}/dns/records

Request (JSON)

```json
{
  "records": [
    {
      "id": "rec_1",
      "type": "A",
      "name": "@",
      "content": "76.76.21.21",
      "ttl": 60,
      "proxied": true
    }
  ]
}
```

Response 200

```json
{
  "name": "your-domain.tld",
  "records": [
    {
      "id": "rec_1",
      "type": "A",
      "name": "@",
      "content": "76.76.21.21",
      "ttl": 60,
      "proxied": true
    }
  ],
  "updatedAt": "2026-01-14T12:00:00Z"
}
```

### POST /api/v1/domains/{name}/ssl/renew

Response 202

```json
{
  "name": "your-domain.tld",
  "sslStatus": "ISSUING"
}
```

## Sites

### GET /api/v1/sites

Query params

- `page` (int, default 1)
- `pageSize` (int, default 20)
- `status` (LIVE|OFFLINE|MAINTENANCE, optional)

Response 200

```json
{
  "items": [
    {
      "id": "site_1",
      "name": "Project Alpha",
      "domain": "project-alpha.lastpush.dev",
      "framework": "vite",
      "status": "LIVE",
      "lastDeployedAt": "2026-01-14T08:00:00Z"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 1
}
```

### POST /api/v1/sites

Request (multipart/form-data)

- `bundle` (file, required)
- `name` (string, required)
- `rootDir` (string, default "./")
- `outputDir` (string, default "dist")

Response 201

```json
{
  "siteId": "site_1",
  "deploymentId": "dep_1",
  "status": "QUEUED"
}
```

### GET /api/v1/sites/{id}

Response 200

```json
{
  "id": "site_1",
  "name": "Project Alpha",
  "domain": "project-alpha.lastpush.dev",
  "framework": "vite",
  "status": "LIVE",
  "lastDeployedAt": "2026-01-14T08:00:00Z",
  "deployments": [
    {
      "id": "dep_1",
      "status": "READY",
      "createdAt": "2026-01-14T08:00:00Z",
      "url": "https://project-alpha.lastpush.dev",
      "logs": []
    }
  ]
}
```

### POST /api/v1/sites/{id}/deployments

Request (multipart/form-data)

- `bundle` (file, required)

Response 201

```json
{
  "deploymentId": "dep_2",
  "status": "QUEUED"
}
```

### GET /api/v1/sites/{id}/deployments

Response 200

```json
{
  "items": [
    {
      "id": "dep_1",
      "status": "READY",
      "createdAt": "2026-01-14T08:00:00Z",
      "url": "https://project-alpha.lastpush.dev",
      "logs": []
    }
  ]
}
```

### GET /api/v1/deployments/{id}/logs

Response 200

```json
{
  "deploymentId": "dep_1",
  "logs": ["line 1", "line 2"]
}
```

### POST /api/v1/deployments/{id}/rollback

Response 202

```json
{
  "deploymentId": "dep_1",
  "status": "QUEUED"
}
```

### DELETE /api/v1/sites/{id}

Response 204 (no body)

## Domains on Sites

### GET /api/v1/sites/{id}/domains

Response 200

```json
{
  "items": [
    {
      "domain": "project-alpha.lastpush.dev",
      "type": "DEFAULT"
    },
    {
      "domain": "alpha.com",
      "type": "PRIMARY"
    }
  ]
}
```

### POST /api/v1/sites/{id}/domains

Request (JSON)

```json
{
  "domain": "alpha.com",
  "type": "PRIMARY"
}
```

Response 201

```json
{
  "domain": "alpha.com",
  "type": "PRIMARY"
}
```

### PATCH /api/v1/sites/{id}/domains/{domain}

Request (JSON)

```json
{
  "type": "PRIMARY"
}
```

Response 200

```json
{
  "domain": "alpha.com",
  "type": "PRIMARY"
}
```

### DELETE /api/v1/sites/{id}/domains/{domain}

Response 204 (no body)

## Billing

### GET /api/v1/billing/balance

Response 200

```json
{
  "balance": 100.0,
  "currency": "USD"
}
```

### POST /api/v1/billing/top-up

Request (JSON)

```json
{
  "amount": 50,
  "method": "CRYPTO"
}
```

Response 200

```json
{
  "paymentId": "pay_123",
  "status": "PENDING",
  "redirectUrl": "https://payments.example/redirect"
}
```

### GET /api/v1/billing/usage

Response 200

```json
{
  "bandwidthGB": 45,
  "bandwidthLimitGB": 100,
  "buildMinutes": 120,
  "buildMinutesLimit": 6000
}
```

### GET /api/v1/billing/transactions

Query params

- `page` (int, default 1)
- `pageSize` (int, default 20)

Response 200

```json
{
  "items": [
    {
      "id": "txn_1",
      "date": "2023-10-24",
      "description": "Domain Renewal (your-domain.tld)",
      "status": "PAID",
      "amount": -14.99,
      "currency": "USD",
      "invoiceUrl": "https://..."
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 1
}
```

### GET /api/v1/billing/payment-methods

Response 200

```json
{
  "items": [
    {
      "id": "pm_1",
      "brand": "VISA",
      "last4": "4242",
      "expiresAt": "2028-12"
    }
  ]
}
```

### POST /api/v1/billing/payment-methods

Request (JSON)

```json
{
  "token": "stripe_or_provider_token"
}
```

Response 201

```json
{
  "id": "pm_2",
  "brand": "MASTERCARD",
  "last4": "4444",
  "expiresAt": "2029-01"
}
```

### DELETE /api/v1/billing/payment-methods/{id}

Response 204 (no body)

## Notifications

### GET /api/v1/notifications/preferences

Response 200

```json
{
  "deploys": true,
  "billing": true,
  "security": false
}
```

### PATCH /api/v1/notifications/preferences

Request (JSON)

```json
{
  "deploys": true,
  "billing": false,
  "security": true
}
```

Response 200

```json
{
  "deploys": true,
  "billing": false,
  "security": true
}
```

## API Keys

### GET /api/v1/api-keys

Response 200

```json
{
  "items": [
    {
      "id": "key_1",
      "label": "Primary",
      "prefix": "lp_",
      "last4": "1234",
      "createdAt": "2026-01-01T00:00:00Z"
    }
  ]
}
```

### POST /api/v1/api-keys

Request (JSON)

```json
{
  "label": "Staging"
}
```

Response 201

```json
{
  "id": "key_2",
  "label": "Staging",
  "token": "lp_xxx_secret_once",
  "createdAt": "2026-01-14T12:00:00Z"
}
```

### POST /api/v1/api-keys/{id}/rotate

Response 200

```json
{
  "id": "key_1",
  "token": "lp_new_secret_once",
  "rotatedAt": "2026-01-14T12:00:00Z"
}
```

### DELETE /api/v1/api-keys/{id}

Response 204 (no body)

## Support

### POST /api/v1/support/tickets

Request (JSON)

```json
{
  "subject": "Billing issue",
  "message": "Details...",
  "priority": "NORMAL"
}
```

Response 201

```json
{
  "ticketId": "tkt_123",
  "status": "OPEN"
}
```

## Admin / Danger Zone

### DELETE /api/v1/workspace

Response 202

```json
{
  "status": "PENDING_DELETION",
  "scheduledAt": "2026-01-21T00:00:00Z"
}
```

