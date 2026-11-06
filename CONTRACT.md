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
`standards`, `baseTemplate` (see §8); optional: `platformBase`.

A Pryv core advertises adapters in `/service/info` as a plain array of **base
URLs**:

```json
{ "adapters": ["https://{username}.example.com/adapter/calendar/"] }
```

Clients fetch `<base>/manifest.json` for the details. `{username}` templating is
allowed, as for the `api` field, and is the recommended form: an adapter is
addressed by username, never by core (§8). The core stores only the URL; the
adapter owns and versions everything else.

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

## 8. Addressed by username, never by core

### The rule

An adapter is addressed at the **account's own address**: the platform's `api`
template from `/service/info` with the username filled in, followed by
`adapter/<name>/`.

```
https://alice.example.com/adapter/calendar/...    per-user address: the account "alice"
https://reg.example.com/adapter/calendar/...      platform address: the adapter, no account
https://core-a.example.com/adapter/calendar/...   platform address too
```

A per-user address is a host of the form `<name>.<platform domain>` (the
platform's `dns.domain`); any other host is a platform address. The name may be
a username or, on platforms that offer them, an address alias the account owner
created. Platforms without per-user hosts (the username in the path, no per-user
DNS) have platform addresses only for now.

### What the core guarantees

Run behind a Pryv core that forwards your route (`adapterRoutes`), the core does
the triage, so the adapter needs no platform knowledge:

- **Routing.** The platform's DNS sends a per-user host to the core that serves
  the account. When a request still reaches another core (a stale resolver after
  the account moved, a hosts entry, a proxy pinned to one core), that core answers
  **`421 wrong-core`** with `Retry-After` itself, for every method, and your
  adapter is not contacted. It never redirects.
- **Two headers** on every request addressed to an account, absent at a platform
  address:

  | Header | Value | Example |
  |---|---|---|
  | `X-Adapter-Name` | the addressed name, lowercased, as addressed (username or, where offered, an alias; a former username stays an address after a rename) | `alice` |
  | `X-Adapter-Base` | your base for that account, as the client addressed it: scheme, host (port kept), your route root, ending with `/` | `https://alice.example.com/adapter/calendar/` |

### What the adapter does

- Its public URLs, its RFC 9728 `resource`, its audience check and every link it
  emits come from `X-Adapter-Base`: `resource = X-Adapter-Base + <path>`, and a
  token is accepted only when `aud === X-Adapter-Base + <its resource path>` (a
  token issued for alice's address presented at bob's fails, whatever the
  headers say).
- **The headers are an address, not an identity.** The core authenticates
  nothing on adapter paths; the access token is the identity. Never read
  `X-Adapter-Name` as "who is calling".
- "Is this request addressed to an account" is "is `X-Adapter-Name` there".
- **No header: a platform address.** Build URLs from your **configured platform
  base** (for instance a `PUBLIC_BASE_URL` setting), serve only what needs no
  account (manifest, status, a sign-in or triage page), a platform-level resource
  if you have one, or `404`. **Never derive a per-user label from `Host`**: which
  host labels are accounts is the platform's knowledge, and the core already
  applied it. Reflecting the request's own origin (`X-Forwarded-Proto` + `Host`)
  into a link is a different act, tolerated for an adapter whose links bind no
  account (a feed whose URL carries its own credentials); a resource server does
  not do it: its `resource` is a published, audience-bound value and comes from
  `X-Adapter-Base` or from its configuration.
- It never calls `/reg/<username>/server`, never keeps a map of cores, never
  matches host labels against a list of region or service names.
- **After an account moves to another core its address is unchanged.** A client
  that gets a `421` or a `503` with `Retry-After` retries **the same per-user
  URL** after the delay. When the platform's token introspection answers the
  adapter `421` for a per-user address (the account is served elsewhere: a move
  in progress, or a stale route), the adapter answers its client `503` with
  `Retry-After`, not `401`. A `coreUrl` member in the answer identifies the core
  that should be answering, for diagnostics only: it is **not** an address to
  call (`coreUrl` + your path is a platform address and names no account).
- A browser UI on a per-user origin: the core adds no CORS header on adapter
  paths, its `421` included, so a browser sees a misrouted request as a CORS or
  network error; retry the same URL a few minutes later. Your own answers carry
  your CORS policy (echo the `Origin` you accept; each account is its own origin).
- An OAuth-protected resource advertises `authorization_servers` = the origin of
  `X-Adapter-Base` when the platform's discovery on that host says the issuer is
  that origin; otherwise its configured issuer.

A dependency-free reader of the two headers ships in
[`examples/addressing.mjs`](examples/addressing.mjs) (`addressedAccount`,
`resourceUrl`, `requireAccount`); copy it.

### Trust

The two headers are trustworthy **only when every request reaches the adapter
through a core of a release that strips client-sent copies** (in any `-` / `_`
spelling, `X_Adapter_Name` included) before setting its own. Therefore:

- **Upgrade each core before the adapter next to it starts reading the headers**,
  core by core. A core of an earlier release forwards client-sent copies.
- Do not publish the adapter's own port: it is reached through the core only.
- A proxy that routes adapter paths **around** the core forfeits the triage and
  the headers: no `421`, no `X-Adapter-*`. Let the core forward adapter paths. If
  a bypass cannot be avoided, the proxy must clear both headers, and the adapter
  serves platform addresses only there: a per-user host reached around the core
  is a platform address, because nobody applied the platform's rule to it (which
  labels are accounts, and where each one lives, is the core's knowledge, never
  yours).

### What a caller does

A caller that holds a username builds the address from `/service/info`: `api`
with `{username}` filled, plus `adapter/<name>/`, or an entry of `adapters` with
`{username}` filled. The manifest's `baseTemplate` carries the same template
form (`https://{username}.example.com/adapter/calendar/`); adapter-specific
endpoint members (an API root, a protocol endpoint) are relative to it, or
absolute in the same template form. `platformBase`, when present, is the base at
a platform address.

A caller that holds no username (a person pasting a platform address into an
app's settings) reaches the adapter at its platform address; the account becomes
known at the OAuth consent, where an account served elsewhere is told to start
again from its own address.

**Optional triage page.** An adapter may serve an "enter your username" page at
its platform address, building the per-user address from `/service/info` `api`
and the name the person typed (checked against the username shape), and offering
it as a link (not a redirect of the request). Never build that link from `Host`
or another request header.
