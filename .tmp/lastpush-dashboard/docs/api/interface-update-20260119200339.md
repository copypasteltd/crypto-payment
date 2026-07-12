# Interface Update 20260119200339

## New Endpoints

### GET /api/v1/orders/{id}

Fetch order details with fulfillment status for the domain lifecycle.

Response 200

```json
{
  "id": "ord_123",
  "type": "REGISTER",
  "domain": "example.com",
  "amount": 12.99,
  "status": "PAID",
  "createdAt": "2026-01-18T12:00:00Z",
  "fulfillmentStatus": "CLOUDFLARE_PENDING"
}
```

### POST /api/v1/orders/{id}/check

Trigger a re-check of the domain purchase + DNS provisioning pipeline.

Response 200

```json
{
  "status": "QUEUED"
}
```

## Notes

- `fulfillmentStatus` enum:
  - `PURCHASING`
  - `PURCHASED`
  - `CLOUDFLARE_PENDING`
  - `ONLINE`
  - `FAILED`
- UI should show pending styling for all statuses except `ONLINE`/`FAILED`.
