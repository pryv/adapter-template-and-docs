# adapter-template-and-docs

Contract, manifest schema and template for **Pryv adapters**.

## What is an adapter?

Open Pryv.io is a general-purpose personal-data store with its own API and data
model. **Adapters** are small services that transiently translate between Pryv
and an established external standard — they own no canonical data themselves.

| Adapter | Direction | Bridges |
|---|---|---|
| [calendar](https://github.com/pryv/adapter-calendar) | bidirectional | iCalendar / RFC 5545 |
| FHIR ↔ Pryv | bidirectional | HL7 FHIR (planned) |
| Mail → Pryv | inbound | email ingest (planned) |

## This repository

- **[CONTRACT.md](CONTRACT.md)** — the rules every adapter follows (transient,
  acts as a regular client, self-describes via a manifest, storage discipline,
  deployment, auth for shareable URLs, event types, addressing by username).
- **[manifest.schema.json](manifest.schema.json)** — JSON Schema for the
  manifest an adapter serves at `GET <base>/manifest.json`.
- **[examples/](examples/)** — worked manifests (currently the calendar adapter).
- **[examples/addressing.mjs](examples/addressing.mjs)**: a dependency-free
  reader of the addressed account (`X-Adapter-Name` / `X-Adapter-Base`) to copy
  into an adapter.

## How a Pryv core advertises adapters

A core lists adapter **base URLs** in `/service/info`:

```json
{ "adapters": ["https://{username}.example.com/adapter/calendar/"] }
```

A client then fetches `<base>/manifest.json` to learn the adapter's name, type,
version and capabilities.

The base is in the `{username}` template form: an adapter is addressed at the
account's own address (`https://alice.example.com/adapter/calendar/`), never by
core or region; the core routes the request and names the account to the
adapter ([CONTRACT.md §8](CONTRACT.md#8-addressed-by-username-never-by-core)).

## Building an adapter

1. Read [CONTRACT.md](CONTRACT.md).
2. Serve a `manifest.json` that validates against
   [`manifest.schema.json`](manifest.schema.json) (see `examples/`).
3. Talk to Pryv as a regular client (e.g. via [lib-js](https://github.com/pryv/lib-js)).
4. Keep state out of the adapter — follow the storage-discipline rules.

## Validate the schema

```sh
npm install
npm test
```


## License

[BSD-3-Clause](https://github.com/pryv/adapter-template-and-docs/blob/master/LICENSE)
