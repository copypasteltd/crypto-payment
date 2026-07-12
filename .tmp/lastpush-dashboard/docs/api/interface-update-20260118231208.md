# Interface Update 20260118231208

## Updated Endpoints

### GET /api/v1/domains/{name}

Add DNS record quota info for the domain.

Response 200 (additions)

```json
{
  "recordLimit": 5,
  "recordUsage": 2
}
```

Notes
- `recordLimit` is the max DNS records allowed for the domain.
- `recordUsage` is the current DNS record count for the domain.

### POST /api/v1/domains/defaults/check

Add DNS record quota info for the selected domain tier.

Response 200 (additions)

```json
{
  "recordLimit": 5,
  "recordUsed": 2
}
```

Notes
- For free domains, `recordLimit` should be 5.
- For paid domains, `recordLimit` should be 20.
- If the user has no remaining quota, `recordLimit - recordUsed` will be 0 and the UI will block deploy/record add.
