import Link from "next/link";

export const metadata = {
  title: "API Reference — Beeroniza",
};

export default function ApiDocsPage() {
  return (
    <main className="container py-5" style={{ maxWidth: "860px" }}>
      {/* Header */}
      <div className="d-flex align-items-baseline justify-content-between mb-4">
        <h1 className="h3 mb-0">Beeroniza API</h1>
        <a className="small text-muted" href="/api/v1/openapi.json">
          openapi.json ↗
        </a>
      </div>

      {/* Authentication */}
      <section className="bnz-card p-4 mb-4">
        <h2 className="h5 mb-3">Authentication</h2>
        <p className="mb-2">
          Create an API key in the dashboard under{" "}
          <Link href="/api-keys">API Keys</Link>. Send it as a Bearer token on
          every request:
        </p>
        <pre className="bnz-code-block mb-2">
          <code>Authorization: Bearer bnz_xxxxxxxxxxxxxxxxxxxxxxxx</code>
        </pre>
        <p className="small text-muted mb-0">
          Keys can be given an expiration date and rotated or revoked from the
          dashboard at any time.
        </p>
      </section>

      {/* How it works */}
      <section className="bnz-card p-4 mb-4">
        <h2 className="h5 mb-3">How it works</h2>
        <ol className="mb-0">
          <li className="mb-2">
            <strong>Discover templates and their placeholders</strong> —{" "}
            <code>GET /api/v1/templates</code>. Each template lists named,
            typed slots (<code>text</code>, <code>image</code>,{" "}
            <code>color</code>) you can fill.
          </li>
          <li className="mb-2">
            <strong>Provide image bytes</strong> (only for{" "}
            <code>image</code> placeholders): pass a public{" "}
            <code>image_url</code>, an inline{" "}
            <code>data:image/...;base64,</code> URL, or upload via{" "}
            <code>POST /api/v1/uploads</code> and use the returned URL.
          </li>
          <li className="mb-2">
            <strong>Submit a generation</strong> —{" "}
            <code>POST /api/v1/images</code>. Returns{" "}
            <code>202</code> with a generation <code>id</code> and{" "}
            <code>status: &quot;queued&quot;</code>.
          </li>
          <li className="mb-0">
            <strong>Get the result</strong> — poll{" "}
            <code>GET /api/v1/images/&#123;id&#125;</code> until{" "}
            <code>status</code> is <code>completed</code> (then{" "}
            <code>image_url</code> is set) or <code>failed</code>. Or pass{" "}
            <code>webhook_url</code> in step&nbsp;3 to be notified instead.
          </li>
        </ol>
      </section>

      {/* Endpoints */}
      <h2 className="h5 mb-3">Endpoints</h2>

      {/* GET /api/v1/templates */}
      <section className="bnz-card p-4 mb-4">
        <div className="d-flex align-items-center gap-2 mb-2">
          <span className="badge bg-success">GET</span>
          <code className="fs-6">/api/v1/templates</code>
        </div>
        <p className="mb-3">
          Lists all templates available to this API key, including each
          template&apos;s placeholders so you know what you can fill in.
        </p>
        <pre className="bnz-code-block mb-3">
          <code>{`curl -H "Authorization: Bearer $BNZ_KEY" \\
  https://your-instance/api/v1/templates`}</code>
        </pre>
        <p className="small text-muted mb-2">Example response:</p>
        <pre className="bnz-code-block mb-0">
          <code>{`{
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
}`}</code>
        </pre>
      </section>

      {/* POST /api/v1/images */}
      <section className="bnz-card p-4 mb-4">
        <div className="d-flex align-items-center gap-2 mb-2">
          <span className="badge bg-primary">POST</span>
          <code className="fs-6">/api/v1/images</code>
        </div>
        <p className="mb-3">
          Submits an async render job. Returns <code>202</code> with the
          generation in status <code>&quot;queued&quot;</code>. Poll{" "}
          <code>GET /api/v1/images/&#123;id&#125;</code> until status is{" "}
          <code>&quot;completed&quot;</code> or <code>&quot;failed&quot;</code>,
          or supply <code>webhook_url</code> to be notified.
        </p>
        <p className="small text-muted mb-1">Request body:</p>
        <table className="table table-sm table-bordered mb-3 small">
          <thead className="table-light">
            <tr>
              <th>Field</th>
              <th>Type</th>
              <th>Required</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>template_id</code></td>
              <td>string</td>
              <td>Yes</td>
              <td>ID of the template to render</td>
            </tr>
            <tr>
              <td><code>modifications</code></td>
              <td>Modification[]</td>
              <td>No</td>
              <td>Placeholder overrides (see data models below)</td>
            </tr>
            <tr>
              <td><code>format</code></td>
              <td>string</td>
              <td>No</td>
              <td><code>png</code> (default), <code>jpg</code>, or <code>webp</code></td>
            </tr>
            <tr>
              <td><code>webhook_url</code></td>
              <td>string</td>
              <td>No</td>
              <td>URL to POST when the job finishes</td>
            </tr>
          </tbody>
        </table>
        <pre className="bnz-code-block mb-3">
          <code>{`curl -X POST https://your-instance/api/v1/images \\
  -H "Authorization: Bearer $BNZ_KEY" \\
  -H "Content-Type: application/json" \\
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
  }'`}</code>
        </pre>
        <p className="small text-muted mb-2">Response <code>202</code>:</p>
        <pre className="bnz-code-block mb-0">
          <code>{`{
  "id": "gen_abc",
  "status": "queued",
  "template_id": "ckxyz123",
  "format": "png",
  "image_url": null,
  "created_at": "2024-01-01T12:00:00.000Z",
  "completed_at": null
}`}</code>
        </pre>
      </section>

      {/* GET /api/v1/images/{id} */}
      <section className="bnz-card p-4 mb-4">
        <div className="d-flex align-items-center gap-2 mb-2">
          <span className="badge bg-success">GET</span>
          <code className="fs-6">/api/v1/images/&#123;id&#125;</code>
        </div>
        <p className="mb-3">
          Poll a generation&apos;s status and result. Once status is{" "}
          <code>&quot;completed&quot;</code>, <code>image_url</code> is set to
          the rendered image URL.
        </p>
        <pre className="bnz-code-block mb-3">
          <code>{`curl -H "Authorization: Bearer $BNZ_KEY" \\
  https://your-instance/api/v1/images/gen_abc`}</code>
        </pre>
        <p className="small text-muted mb-2">Example response (completed):</p>
        <pre className="bnz-code-block mb-0">
          <code>{`{
  "id": "gen_abc",
  "status": "completed",
  "template_id": "ckxyz123",
  "width": 1200,
  "height": 630,
  "format": "png",
  "image_url": "https://your-instance/api/files/file_789",
  "error": null,
  "created_at": "2024-01-01T12:00:00.000Z",
  "completed_at": "2024-01-01T12:00:04.123Z"
}`}</code>
        </pre>
      </section>

      {/* POST /api/v1/uploads */}
      <section className="bnz-card p-4 mb-4">
        <div className="d-flex align-items-center gap-2 mb-2">
          <span className="badge bg-primary">POST</span>
          <code className="fs-6">/api/v1/uploads</code>
        </div>
        <p className="mb-3">
          Upload image bytes and receive a URL usable as an{" "}
          <code>image_url</code> in a modification. Accepts{" "}
          <code>multipart/form-data</code> (field <code>file</code>) or JSON{" "}
          (<code>file_base64</code> + <code>mime_type</code>).
        </p>
        <p className="small text-muted mb-1">Multipart upload:</p>
        <pre className="bnz-code-block mb-3">
          <code>{`curl -X POST https://your-instance/api/v1/uploads \\
  -H "Authorization: Bearer $BNZ_KEY" \\
  -F "file=@avatar.png"`}</code>
        </pre>
        <p className="small text-muted mb-1">JSON / base64 upload:</p>
        <pre className="bnz-code-block mb-3">
          <code>{`curl -X POST https://your-instance/api/v1/uploads \\
  -H "Authorization: Bearer $BNZ_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "file_base64": "iVBORw0KGgo…", "mime_type": "image/png" }'`}</code>
        </pre>
        <p className="small text-muted mb-2">Response <code>201</code>:</p>
        <pre className="bnz-code-block mb-0">
          <code>{`{ "id": "file_123", "url": "https://your-instance/api/files/file_123" }`}</code>
        </pre>
      </section>

      {/* Data models */}
      <h2 className="h5 mb-3">Data models</h2>

      {/* Placeholder */}
      <section className="bnz-card p-4 mb-4">
        <h3 className="h6 mb-3">Placeholder</h3>
        <p className="mb-3 small text-muted">
          Returned inside each Template. Describes a named slot you can fill
          with a Modification.
        </p>
        <table className="table table-sm table-bordered mb-0 small">
          <thead className="table-light">
            <tr>
              <th>Field</th>
              <th>Type</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>key</code></td>
              <td>string</td>
              <td>Use this as <code>name</code> in a Modification</td>
            </tr>
            <tr>
              <td><code>type</code></td>
              <td><code>text</code> | <code>image</code> | <code>color</code></td>
              <td>Determines which field to set in the Modification</td>
            </tr>
            <tr>
              <td><code>label</code></td>
              <td>string</td>
              <td>Human-readable name</td>
            </tr>
            <tr>
              <td><code>defaultValue</code></td>
              <td>string</td>
              <td>Value used when no modification is provided</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Modification */}
      <section className="bnz-card p-4 mb-4">
        <h3 className="h6 mb-3">Modification</h3>
        <p className="mb-3 small text-muted">
          Overrides one placeholder layer. Set the field matching the
          placeholder&apos;s type.
        </p>
        <table className="table table-sm table-bordered mb-0 small">
          <thead className="table-light">
            <tr>
              <th>Field</th>
              <th>Type</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>name</code></td>
              <td>string</td>
              <td>The placeholder key to target (required)</td>
            </tr>
            <tr>
              <td><code>text</code></td>
              <td>string</td>
              <td>For <code>text</code> placeholders</td>
            </tr>
            <tr>
              <td><code>image_url</code></td>
              <td>string</td>
              <td>
                For <code>image</code> placeholders. Public http(s) URL or inline{" "}
                <code>data:image/...;base64,</code> URL.
              </td>
            </tr>
            <tr>
              <td><code>color</code></td>
              <td>string</td>
              <td>
                For <code>color</code> placeholders. Hex color, e.g.{" "}
                <code>#0b0b1a</code>.
              </td>
            </tr>
            <tr>
              <td><code>focal_point</code></td>
              <td><code>&#123; x, y &#125;</code></td>
              <td>
                Optional normalized focal point (0–1) for cover-cropping — keeps
                this point in view instead of cropping to the geometric center.
                Only applies to <code>image_url</code>.
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Generation */}
      <section className="bnz-card p-4 mb-4">
        <h3 className="h6 mb-3">Generation</h3>
        <p className="mb-3 small text-muted">
          Returned by POST /api/v1/images and GET /api/v1/images/&#123;id&#125;.
        </p>
        <table className="table table-sm table-bordered mb-0 small">
          <thead className="table-light">
            <tr>
              <th>Field</th>
              <th>Type</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>id</code></td>
              <td>string</td>
              <td>Generation ID</td>
            </tr>
            <tr>
              <td><code>status</code></td>
              <td>string</td>
              <td>
                <code>queued</code>, <code>processing</code>,{" "}
                <code>completed</code>, or <code>failed</code>
              </td>
            </tr>
            <tr>
              <td><code>template_id</code></td>
              <td>string</td>
              <td>ID of the template used</td>
            </tr>
            <tr>
              <td><code>width</code> / <code>height</code></td>
              <td>integer</td>
              <td>Output dimensions in pixels</td>
            </tr>
            <tr>
              <td><code>format</code></td>
              <td>string</td>
              <td>Output format: <code>png</code>, <code>jpg</code>, or <code>webp</code></td>
            </tr>
            <tr>
              <td><code>image_url</code></td>
              <td>string | null</td>
              <td>Set once status is <code>completed</code></td>
            </tr>
            <tr>
              <td><code>error</code></td>
              <td>string | null</td>
              <td>Error message if status is <code>failed</code></td>
            </tr>
            <tr>
              <td><code>created_at</code></td>
              <td>string (ISO 8601)</td>
              <td>When the job was submitted</td>
            </tr>
            <tr>
              <td><code>completed_at</code></td>
              <td>string | null</td>
              <td>When the job finished</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Notes */}
      <section className="bnz-card p-4 mb-4">
        <h2 className="h5 mb-3">Notes</h2>
        <ul className="mb-0">
          <li className="mb-1">
            Generation is <strong>asynchronous</strong>. A render takes a few
            seconds. Always poll or use a webhook — there is no synchronous
            variant.
          </li>
          <li className="mb-1">
            The webhook receives a <code>POST</code> with body{" "}
            <code>&#123; &quot;id&quot;, &quot;status&quot;, &quot;url&quot; &#125;</code> when
            the job finishes.
          </li>
          <li>
            Result images are served from{" "}
            <code>/api/files/&#123;id&#125;</code>.
          </li>
        </ul>
      </section>
    </main>
  );
}
