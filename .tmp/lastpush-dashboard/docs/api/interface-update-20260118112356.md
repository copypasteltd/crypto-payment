# Interface Update 20260118112356

## Updated Endpoint

### POST /api/v1/sites

Allow choosing between a file upload or a URL for the bundle source.

Request (multipart/form-data)

- `bundle` (file, optional; required when using file upload)
- `bundleUrl` (string, optional; required when using URL)
- `name` (string, required)
- `domainPrefix` (string, required)
- `baseDomain` (string, optional; omit to use the default domain)

Notes
- Exactly one of `bundle` or `bundleUrl` must be provided.
