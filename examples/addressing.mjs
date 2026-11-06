/**
 * @license
 * [BSD-3-Clause](https://github.com/pryv/adapter-template-and-docs/blob/master/LICENSE)
 */
/**
 * Reference reader for the addressed account (CONTRACT.md section 8).
 *
 * On a request addressed to an account (`https://alice.example.com/adapter/calendar/...`)
 * the Pryv core sets two headers before forwarding it to the adapter:
 *
 *     X-Adapter-Name: alice
 *     X-Adapter-Base: https://alice.example.com/adapter/calendar/
 *
 * Both are absent at a platform address (`https://reg.example.com/adapter/calendar/...`).
 *
 * THE HEADERS ARE AN ADDRESS, NOT AN IDENTITY. The core authenticates nothing on
 * adapter paths: the access token is the identity. Use the base for your public
 * URLs, your RFC 9728 `resource` and your audience check (`aud === base + path`),
 * never as proof of who is calling. Trust them only when every request reaches
 * you through a core that strips client-sent copies (CONTRACT.md section 8,
 * "Trust").
 *
 * Dependency-free, copy it into your adapter (it is not a package). Works with a
 * Node `IncomingMessage` (`req.headers` object) and with a Fetch API `Request`
 * (`req.headers.get()`).
 */

const NAME_HEADER = 'x-adapter-name';
const BASE_HEADER = 'x-adapter-base';

function header (req, name) {
  const headers = req?.headers;
  if (headers == null) return null;
  const value = typeof headers.get === 'function' ? headers.get(name) : headers[name];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function isBaseUrl (value) {
  let url;
  try { url = new URL(value); } catch { return false; }
  return (url.protocol === 'https:' || url.protocol === 'http:') &&
    url.username === '' && url.password === '' && url.search === '' && url.hash === '' &&
    !/[\s,]/.test(value) && value.endsWith('/');
}

/**
 * The account a request is addressed to, or `null` at a platform address.
 * A malformed pair (which the core never sends) is read as absent.
 * @returns {{ name: string, base: string } | null} `name` is the addressed name
 *   (a username or an alias), `base` the adapter's base URL for that account.
 */
export function addressedAccount (req) {
  const name = header(req, NAME_HEADER);
  const base = header(req, BASE_HEADER);
  if (name == null || base == null) return null;
  if (!/^[a-z0-9-]+$/.test(name) || !isBaseUrl(base)) return null;
  return { name, base };
}

/**
 * The public URL of `path` (relative, no leading `/`) for this request: under the
 * addressed account's base, else under `platformBase`, the adapter's own configured
 * base at a platform address. Never built from `Host`.
 */
export function resourceUrl (req, path, platformBase) {
  const account = addressedAccount(req);
  const base = account != null ? account.base : platformBase;
  return base + path.replace(/^\/+/, '');
}

/**
 * For a route that only makes sense for an account: returns the addressed account,
 * or answers 404 JSON (Node `ServerResponse`) and returns `null` at a platform
 * address. The answer reflects nothing from the request.
 */
export function requireAccount (req, res) {
  const account = addressedAccount(req);
  if (account != null) return account;
  res.writeHead(404, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify({
    error: {
      id: 'unknown-resource',
      message: 'this resource is served at a per-user address: https://<username>.<platform domain>/adapter/<name>/'
    }
  }));
  return null;
}
