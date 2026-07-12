# Interface Update 20260119224627

## New Endpoints

### POST /api/v1/domains/{name}/dns/records

Create a single DNS record.

Request (JSON)

```json
{
  "type": "A",
  "name": "@",
  "content": "76.76.21.21",
  "ttl": 60,
  "proxied": false
}
```

Response 200

```json
{
  "id": "rec_123",
  "type": "A",
  "name": "@",
  "content": "76.76.21.21",
  "ttl": 60,
  "proxied": false
}
```

### PATCH /api/v1/domains/{name}/dns/records/{id}

Update a single DNS record.

Request (JSON)

```json
{
  "type": "CNAME",
  "name": "www",
  "content": "app.example.com",
  "ttl": 120,
  "proxied": true
}
```

Response 200

```json
{
  "id": "rec_123",
  "type": "CNAME",
  "name": "www",
  "content": "app.example.com",
  "ttl": 120,
  "proxied": true
}
```

### DELETE /api/v1/domains/{name}/dns/records/{id}

Delete a single DNS record.

Response 204 (no body)

## Notes

- UI updates operate on one record at a time; bulk updates are no longer used.
