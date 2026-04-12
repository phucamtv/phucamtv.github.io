# Data Receiver

Simple Bun HTTP server that receives content via POST and saves it to disk.

## Run

```
bun run server.ts
```

Listens on `http://localhost:3000`.

## Endpoint

### `POST /data?filename=<string>`

Saves the request body to `./data/<filename>`.

| Param | Location | Required | Description |
|-------|----------|----------|-------------|
| `filename` | query string | yes | Target filename (sanitized: only `a-zA-Z0-9._-` allowed, rest replaced with `_`) |

**Request body:** raw content to save (any content type).

**Responses:**

| Status | Body |
|--------|------|
| 200 | `Saved <filename>` |
| 400 | `Missing filename param` |
| 404 | `Not found` |

**Example:**

```bash
curl -X POST "http://localhost:3000/data?filename=page.html" -d "<html>hello</html>"
```
