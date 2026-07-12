# Interface Update 20260121234943

## New Login Flow (X)

### GET /x_login

Starts the X OAuth login flow and redirects the user to X for authorization.

Query parameters

- `redirect`: optional path to return to after login (e.g. `/dashboard`)
- `callback`: full URL to redirect back to the frontend (e.g. `https://app.lastpush.xyz/login`)

The backend should redirect back to the `callback` URL with a temporary token in the query string:

```
GET {callback}?token=TEMP_TOKEN&redirect=/dashboard
```

### POST /api/v1/auth/login/x/verify

Exchanges the temporary token for a session token and user info.

Request (JSON)

```json
{
  "token": "TEMP_TOKEN"
}
```

Response 200

```json
{
  "token": "JWT_TOKEN",
  "user": {
    "id": "user_123"
  }
}
```
