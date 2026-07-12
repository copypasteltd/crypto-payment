# Interface Update 20260118110440

## New Endpoints

### GET /api/v1/domains/defaults

Returns the list of supported default base domains that users can pick during site deployment.

Response 200

```json
{
  "items": ["lastpush.dev", "lastpush.app"]
}
```

### POST /api/v1/domains/defaults/check

Checks whether a prefix is available under a selected default base domain.
If `baseDomain` is omitted, the backend should use its default domain selection rules.

Request (JSON)

```json
{
  "prefix": "my-site",
  "baseDomain": "lastpush.dev"
}
```

Response 200

```json
{
  "available": true,
  "message": "Available"
}
```

## Updated Endpoint

### POST /api/v1/sites

Add optional domain selection fields to the existing multipart upload.

Request (multipart/form-data)

- `bundle` (file, required)
- `name` (string, required)
- `rootDir` (string, default "./")
- `outputDir` (string, default "dist")
- `domainPrefix` (string, required)
- `baseDomain` (string, optional; omit to use the default domain)
