# Adapter contract

Rules every Pryv adapter agrees to. Extracted from the first adapter
([adapter-calendar](https://github.com/pryv/adapter-calendar)); refined as more
adapters ship.

## 1. Transient and memory-less

An adapter owns **no canonical user data**. It translates, on demand, between
the Pryv API and an external standard. A restart is a clean slate. Any state it
needs is stored elsewhere (see §4), never in the adapter process.

## 2. Acts as a regular Pryv client

An adapter authenticates to Pryv with ordinary access tokens and has **no
system-stream or privileged access**. It can only do what the access granted to
it allows. This makes adapter behaviour transparent and auditable: a user sees,
and can revoke, an adapter exactly like any other app.

## 3. Self-describes via a manifest

An adapter serves a manifest at `GET <base>/manifest.json`, validating against
[`manifest.schema.json`](manifest.schema.json). Required fields: `name`, `type`,
`version`. Recommended: `title`, `description`, `useCases`, `ui`, `auth`,
`standards`.

A Pryv core advertises adapters in `/service/info` as a plain array of **base
URLs**:

```json
{ "adapters": ["https://{username}.example.com/adapter/calendar/"] }
```

Clients fetch `<base>/manifest.json` for the details. `{username}` templating is
allowed, as for the `api` field. The core stores only the URL — the adapter owns
and versions everything else.

## 4. Storage discipline

When an adapter genuinely needs to persist state, in order of preference:

1. **Per-user settings → a stream on that user's own account.** Use an ordinary,
   user-visible stream the user has granted the adapter access to. Transparency
   is the point: the user can inspect and delete adapter settings like any data.
2. **Non-user-bound state → a single platform account** shared across
   deployments of the same adapter.
3. **Per-user credentials to a user's space → the CMC (cross-account) pattern**,
   with the credential-holding account on the **same core** as the related users
   (data residency).

## 5. Deployment

An adapter is deployable **alongside a core** (sidecar, reverse-proxied under a
path such as `/adapter/<type>/`) **or one-to-many** across cores. URL, auth and
token-storage layers should be written so that switching between the two is a
configuration change, not a rewrite.

## 6. Auth for shareable URLs

When an adapter hands out a URL that carries access (e.g. a subscription feed),
offer at least:

- **plaintext** — the access token is embedded in the URL. Simplest; the leak
  surface is the URL itself.
- **sealed** — an authenticated, encrypted envelope (e.g. AES-256-GCM) carrying
  the token + parameters + an expiry. The token is opaque in the URL; revoke by
  rotating the adapter key or deleting the inner token.

Mind external length limits: some calendar clients cap subscription URLs around
**225 characters**, well below browser/HTTP limits — keep sealed envelopes
compact (compact binary, base64url, no padding) rather than JWT-style JSON.

## 7. Event types

When an adapter ingests external records as Pryv events, keep the well-known
fields in structured `content` (queryable) and the verbatim source record in
`clientData._raw` (lossless round-trip). Register the event type in
[`data-types`](https://github.com/pryv/data-types).
