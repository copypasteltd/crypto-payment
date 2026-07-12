# Interface Update 20260119201730

## New Endpoints

### GET /api/v1/orders

List domain orders with fulfillment status for the orders index page.

Response 200

```json
{
  "items": [
    {
      "id": "ord_123",
      "type": "REGISTER",
      "domain": "example.com",
      "amount": 12.99,
      "status": "PAID",
      "createdAt": "2026-01-18T12:00:00Z",
      "fulfillmentStatus": "CLOUDFLARE_PENDING"
    }
  ]
}
```
