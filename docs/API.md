# Beeroniza REST API

Generate images from templates programmatically. The API is designed to be
consumed by scripts **and by LLM agents** — there is a machine-readable
OpenAPI 3.1 spec and a classic API reference:

- **OpenAPI spec:** `GET /api/v1/openapi.json`
- **API reference:** `/api-docs`

Base URL: your instance, e.g. `https://banners.example.com`.

## Authentication

Create an API key in the dashboard (**API Keys** → *Create key*). Send it as a
Bearer token on every request:

```
Authorization: Bearer bnz_xxxxxxxxxxxxxxxxxxxxxxxx
```

Keys can be given an expiration date and rotated/revoked from the dashboard.

## The flow (for agents)

1. **Discover templates and their placeholders** — `GET /api/v1/templates`.
   Each template lists `placeholders`: named, typed slots (`text`, `image`,
   `color`) you can fill. All templates of an instance are shared across all
   users and API keys — there is no per-user visibility.
2. **Provide image bytes** (only if a placeholder is of type `image`):
   - pass a public `image_url`, **or**
   - pass an inline `data:image/...;base64,...` URL directly in the
     modification, **or**
   - `POST /api/v1/uploads` and use the returned `url`.
3. **Submit a generation** — `POST /api/v1/images`. Returns `202` with a
   generation `id` and `status: "queued"`.
4. **Get the result** — poll `GET /api/v1/images/{id}` until `status` is
   `completed` (then `image_url` is set) or `failed`. Or pass `webhook_url` in
   step 3 to be notified.

## Endpoints

### List templates
```bash
curl -H "Authorization: Bearer $BNZ_KEY" \
  https://banners.example.com/api/v1/templates
```
```json
{
  "templates": [
    {
      "id": "ckxyz123",
      "name": "OpenGraph author card",
      "width": 1200,
      "height": 630,
      "placeholders": [
        { "key": "title", "type": "text", "label": "Headline" },
        { "key": "author_name", "type": "text", "label": "Author name" },
        { "key": "avatar", "type": "image", "label": "Author avatar" },
        { "key": "background", "type": "color", "label": "Background color" }
      ]
    }
  ]
}
```

### Generate an image
```bash
curl -X POST https://banners.example.com/api/v1/images \
  -H "Authorization: Bearer $BNZ_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "template_id": "ckxyz123",
    "modifications": [
      { "name": "title", "text": "Hello from an AI agent" },
      { "name": "author_name", "text": "Ada Lovelace" },
      { "name": "avatar", "image_url": "https://example.com/ada.png" },
      { "name": "background", "color": "#0b0b1a" }
    ],
    "format": "png",
    "webhook_url": "https://my.app/hooks/beeroniza"
  }'
```
`format` is one of `png` (default), `jpg`, or `webp`.
Response `202`:
```json
{ "id": "gen_abc", "status": "queued", "image_url": null, "...": "..." }
```

A **modification** targets one placeholder by `name` (the placeholder `key`) and
sets the field matching its type:
- `text` → `"text": "…"`
- `image` → `"image_url": "https://…"` or `"image_url": "data:image/png;base64,…"`
- `color` → `"color": "#RRGGBB"`

### Poll the result
```bash
curl -H "Authorization: Bearer $BNZ_KEY" \
  https://banners.example.com/api/v1/images/gen_abc
```
```json
{
  "id": "gen_abc",
  "status": "completed",
  "image_url": "https://banners.example.com/api/files/file_789",
  "width": 1200, "height": 630, "format": "png",
  "created_at": "…", "completed_at": "…"
}
```

### Upload an image
Multipart:
```bash
curl -X POST https://banners.example.com/api/v1/uploads \
  -H "Authorization: Bearer $BNZ_KEY" \
  -F "file=@avatar.png"
```
or JSON with base64:
```bash
curl -X POST https://banners.example.com/api/v1/uploads \
  -H "Authorization: Bearer $BNZ_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "file_base64": "iVBORw0KGgo…", "mime_type": "image/png" }'
```
Response `201`: `{ "id": "file_123", "url": "https://…/api/files/file_123" }`.
Use that `url` as an `image_url` in a modification.

## Notes

- Generation is **asynchronous**; a render takes a few seconds. Always poll or
  use a webhook — there is no synchronous variant.
- The webhook receives `POST { "id", "status", "url" }` when the job finishes.
- Result images are served from `/api/files/{id}` and carry no font-license
  restrictions (see `THIRD_PARTY_LICENSES.md`).
