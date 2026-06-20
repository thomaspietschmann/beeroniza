import type { PlaceholderDef } from "@/lib/template/schema";

// ─────────────────────────────────────────────────────────────────────────
// Multi-language API code snippets for the docs and the in-app API preview.
//
// Given a serializable request `spec`, we render a copy-pasteable example in
// the requested language using that language's *standard* HTTP library:
//
//   curl    – curl
//   httpie  – the `http` CLI
//   ruby    – net/http (+ json, base64) — all stdlib
//   node    – built-in global fetch (Node 18+) and node:fs
//   python  – urllib.request (+ json, base64) — all stdlib
//   java    – java.net.http.HttpClient (+ java.util.Base64) — JDK 11+
//
// Image inputs can be shown two ways, toggled by `imageMode`:
//   "url"    – pass a public image_url
//   "binary" – read a local file, base64-encode it and inline a data: URL
// ─────────────────────────────────────────────────────────────────────────

export const SNIPPET_LANGS = [
  { id: "curl", label: "curl" },
  { id: "httpie", label: "HTTPie" },
  { id: "ruby", label: "Ruby" },
  { id: "node", label: "Node.js" },
  { id: "python", label: "Python" },
  { id: "java", label: "Java" },
] as const;

export type SnippetLang = (typeof SNIPPET_LANGS)[number]["id"];
export type ImageMode = "url" | "binary";

export type SnippetMod =
  | { name: string; type: "text"; value: string }
  | { name: string; type: "color"; value: string }
  | { name: string; type: "image"; value: string };

export type SnippetSpec =
  | {
      kind: "createImage";
      origin: string;
      templateId: string;
      mods: SnippetMod[];
      format: string;
    }
  | { kind: "get"; url: string };

const ENV = "BEERONIZA_API_KEY";
const IMAGE_FILE = "avatar.png";

// Map a template placeholder to an example modification.
export function placeholderToMod(p: PlaceholderDef): SnippetMod {
  if (p.type === "image") return { name: p.key, type: "image", value: "https://example.com/image.png" };
  if (p.type === "color") return { name: p.key, type: "color", value: "#6c5ce7" };
  return { name: p.key, type: "text", value: p.defaultValue ?? p.label ?? "Your text" };
}

const q = (s: string) => JSON.stringify(s);
const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9]/g, "_");
const imageFileFor = (name: string) => `${sanitize(name)}.png`;
const shellVar = (name: string) => `${sanitize(name).toUpperCase()}_DATA`;
const snakeVar = (name: string) => `${sanitize(name).toLowerCase()}_data`;
const camelVar = (name: string) => {
  const s = sanitize(name);
  return `${s.charAt(0).toLowerCase()}${s.slice(1)}Data`;
};

function imageMods(mods: SnippetMod[]): SnippetMod[] {
  return mods.filter((m) => m.type === "image");
}

// ── JSON body (raw) for curl / HTTPie / Java text blocks ───────────────────

function jsonBody(
  spec: Extract<SnippetSpec, { kind: "createImage" }>,
  imageRender: (m: SnippetMod) => string,
): string {
  const lines = spec.mods.map((m) => {
    if (m.type === "text") return `    { "name": ${q(m.name)}, "text": ${q(m.value)} }`;
    if (m.type === "color") return `    { "name": ${q(m.name)}, "color": ${q(m.value)} }`;
    return `    { "name": ${q(m.name)}, "image_url": ${imageRender(m)} }`;
  });
  const mods = lines.length ? `[\n${lines.join(",\n")}\n  ]` : "[]";
  return [
    "{",
    `  "template_id": ${q(spec.templateId)},`,
    `  "modifications": ${mods},`,
    `  "format": ${q(spec.format)}`,
    "}",
  ].join("\n");
}

// ── curl ───────────────────────────────────────────────────────────────────

function curlCreate(spec: Extract<SnippetSpec, { kind: "createImage" }>, mode: ImageMode): string {
  const url = `${spec.origin}/api/v1/images`;
  const headers = [`  -H "Authorization: Bearer $${ENV}" \\`, `  -H "Content-Type: application/json" \\`];
  if (mode === "binary" && imageMods(spec.mods).length) {
    const vars = imageMods(spec.mods).map(
      (m) => `${shellVar(m.name)}="data:image/png;base64,$(base64 < ${imageFileFor(m.name)} | tr -d '\\n')"`,
    );
    const body = jsonBody(spec, (m) => `"$${shellVar(m.name)}"`).replace(/"/g, '\\"');
    return [
      ...vars,
      "",
      `curl -X POST ${url} \\`,
      ...headers,
      `  -d "${body}"`,
    ].join("\n");
  }
  const body = jsonBody(spec, (m) => q(m.value));
  return [`curl -X POST ${url} \\`, ...headers, `  -d '${body}'`].join("\n");
}

function curlGet(url: string): string {
  return [`curl -H "Authorization: Bearer $${ENV}" \\`, `  ${url}`].join("\n");
}

// ── HTTPie ───────────────────────────────────────────────────────────────

function httpieCreate(spec: Extract<SnippetSpec, { kind: "createImage" }>, mode: ImageMode): string {
  const url = `${spec.origin}/api/v1/images`;
  const tail = [`  http POST ${url} \\`, `  Authorization:"Bearer $${ENV}" \\`, `  Content-Type:application/json`];
  if (mode === "binary" && imageMods(spec.mods).length) {
    const vars = imageMods(spec.mods).map(
      (m) => `${shellVar(m.name)}="data:image/png;base64,$(base64 < ${imageFileFor(m.name)} | tr -d '\\n')"`,
    );
    const body = jsonBody(spec, (m) => `"$${shellVar(m.name)}"`).replace(/"/g, '\\"');
    return [...vars, "", `echo "${body}" | \\`, ...tail].join("\n");
  }
  const body = jsonBody(spec, (m) => q(m.value));
  return [`echo '${body}' | \\`, ...tail].join("\n");
}

function httpieGet(url: string): string {
  return [`http ${url} \\`, `  Authorization:"Bearer $${ENV}"`].join("\n");
}

// ── Node.js (built-in fetch) ───────────────────────────────────────────────

function nodeModLine(m: SnippetMod, mode: ImageMode): string {
  if (m.type === "text") return `    { name: ${q(m.name)}, text: ${q(m.value)} },`;
  if (m.type === "color") return `    { name: ${q(m.name)}, color: ${q(m.value)} },`;
  if (mode === "binary") return `    { name: ${q(m.name)}, image_url: ${camelVar(m.name)} },`;
  return `    { name: ${q(m.name)}, image_url: ${q(m.value)} },`;
}

function nodeCreate(spec: Extract<SnippetSpec, { kind: "createImage" }>, mode: ImageMode): string {
  const url = `${spec.origin}/api/v1/images`;
  const imgs = imageMods(spec.mods);
  const binary = mode === "binary" && imgs.length > 0;
  const out: string[] = [];
  if (binary) out.push(`import { readFileSync } from "node:fs";`, "");
  if (binary) {
    for (const m of imgs) {
      out.push(
        `const ${camelVar(m.name)} =`,
        `  "data:image/png;base64," + readFileSync(${q(imageFileFor(m.name))}).toString("base64");`,
      );
    }
    out.push("");
  }
  out.push(
    `const res = await fetch(${q(url)}, {`,
    `  method: "POST",`,
    `  headers: {`,
    `    Authorization: \`Bearer \${process.env.${ENV}}\`,`,
    `    "Content-Type": "application/json",`,
    `  },`,
    `  body: JSON.stringify({`,
    `    template_id: ${q(spec.templateId)},`,
    `    modifications: [`,
    ...spec.mods.map((m) => `  ${nodeModLine(m, mode)}`),
    `    ],`,
    `    format: ${q(spec.format)},`,
    `  }),`,
    `});`,
    `console.log(await res.json());`,
  );
  return out.join("\n");
}

function nodeGet(url: string): string {
  return [
    `const res = await fetch(${q(url)}, {`,
    `  headers: { Authorization: \`Bearer \${process.env.${ENV}}\` },`,
    `});`,
    `console.log(await res.json());`,
  ].join("\n");
}

// ── Python (urllib.request) ────────────────────────────────────────────────

function pyModLine(m: SnippetMod, mode: ImageMode): string {
  if (m.type === "text") return `        {"name": ${q(m.name)}, "text": ${q(m.value)}},`;
  if (m.type === "color") return `        {"name": ${q(m.name)}, "color": ${q(m.value)}},`;
  if (mode === "binary") return `        {"name": ${q(m.name)}, "image_url": ${snakeVar(m.name)}},`;
  return `        {"name": ${q(m.name)}, "image_url": ${q(m.value)}},`;
}

function pyCreate(spec: Extract<SnippetSpec, { kind: "createImage" }>, mode: ImageMode): string {
  const url = `${spec.origin}/api/v1/images`;
  const imgs = imageMods(spec.mods);
  const binary = mode === "binary" && imgs.length > 0;
  const out: string[] = [];
  out.push(binary ? "import base64, json, os, urllib.request" : "import json, os, urllib.request", "");
  if (binary) {
    for (const m of imgs) {
      out.push(
        `with open(${q(imageFileFor(m.name))}, "rb") as f:`,
        `    ${snakeVar(m.name)} = "data:image/png;base64," + base64.b64encode(f.read()).decode()`,
      );
    }
    out.push("");
  }
  out.push(
    `payload = {`,
    `    "template_id": ${q(spec.templateId)},`,
    `    "modifications": [`,
    ...spec.mods.map((m) => pyModLine(m, mode)),
    `    ],`,
    `    "format": ${q(spec.format)},`,
    `}`,
    `req = urllib.request.Request(`,
    `    ${q(url)},`,
    `    data=json.dumps(payload).encode(),`,
    `    method="POST",`,
    `    headers={`,
    `        "Authorization": "Bearer " + os.environ[${q(ENV)}],`,
    `        "Content-Type": "application/json",`,
    `    },`,
    `)`,
    `with urllib.request.urlopen(req) as resp:`,
    `    print(resp.read().decode())`,
  );
  return out.join("\n");
}

function pyGet(url: string): string {
  return [
    "import os, urllib.request",
    "",
    `req = urllib.request.Request(`,
    `    ${q(url)},`,
    `    headers={"Authorization": "Bearer " + os.environ[${q(ENV)}]},`,
    `)`,
    `with urllib.request.urlopen(req) as resp:`,
    `    print(resp.read().decode())`,
  ].join("\n");
}

// ── Ruby (net/http) ──────────────────────────────────────────────────────

function rbModLine(m: SnippetMod, mode: ImageMode): string {
  if (m.type === "text") return `    { name: ${q(m.name)}, text: ${q(m.value)} },`;
  if (m.type === "color") return `    { name: ${q(m.name)}, color: ${q(m.value)} },`;
  if (mode === "binary") return `    { name: ${q(m.name)}, image_url: ${snakeVar(m.name)} },`;
  return `    { name: ${q(m.name)}, image_url: ${q(m.value)} },`;
}

function rbCreate(spec: Extract<SnippetSpec, { kind: "createImage" }>, mode: ImageMode): string {
  const url = `${spec.origin}/api/v1/images`;
  const imgs = imageMods(spec.mods);
  const binary = mode === "binary" && imgs.length > 0;
  const out: string[] = [`require "net/http"`, `require "json"`, `require "uri"`];
  if (binary) out.push(`require "base64"`);
  out.push(
    "",
    `uri = URI(${q(url)})`,
    `http = Net::HTTP.new(uri.host, uri.port)`,
    `http.use_ssl = uri.scheme == "https"`,
    "",
  );
  if (binary) {
    for (const m of imgs) {
      out.push(`${snakeVar(m.name)} = "data:image/png;base64," + Base64.strict_encode64(File.read(${q(imageFileFor(m.name))}))`);
    }
    out.push("");
  }
  out.push(
    `req = Net::HTTP::Post.new(uri)`,
    `req["Authorization"] = "Bearer #{ENV[${q(ENV)}]}"`,
    `req["Content-Type"] = "application/json"`,
    `req.body = {`,
    `  template_id: ${q(spec.templateId)},`,
    `  modifications: [`,
    ...spec.mods.map((m) => rbModLine(m, mode)),
    `  ],`,
    `  format: ${q(spec.format)}`,
    `}.to_json`,
    "",
    `puts http.request(req).body`,
  );
  return out.join("\n");
}

function rbGet(url: string): string {
  return [
    `require "net/http"`,
    `require "uri"`,
    "",
    `uri = URI(${q(url)})`,
    `req = Net::HTTP::Get.new(uri)`,
    `req["Authorization"] = "Bearer #{ENV[${q(ENV)}]}"`,
    "",
    `http = Net::HTTP.new(uri.host, uri.port)`,
    `http.use_ssl = uri.scheme == "https"`,
    `puts http.request(req).body`,
  ].join("\n");
}

// ── Java (java.net.http) ───────────────────────────────────────────────────

function javaCreate(spec: Extract<SnippetSpec, { kind: "createImage" }>, mode: ImageMode): string {
  const url = `${spec.origin}/api/v1/images`;
  const imgs = imageMods(spec.mods);
  const binary = mode === "binary" && imgs.length > 0;
  const imports = [
    "import java.net.URI;",
    "import java.net.http.HttpClient;",
    "import java.net.http.HttpRequest;",
    "import java.net.http.HttpResponse;",
  ];
  if (binary) imports.push("import java.nio.file.Files;", "import java.nio.file.Path;", "import java.util.Base64;");

  // Body as a text block. In binary mode each image_url becomes a %s filled via .formatted(...).
  const bodyText = jsonBody(spec, (m) => (binary ? `"%s"` : q(m.value)))
    .split("\n")
    .map((l) => `        ${l}`)
    .join("\n");

  const inner: string[] = [];
  if (binary) {
    for (const m of imgs) {
      inner.push(
        `    String ${camelVar(m.name)} = "data:image/png;base64," +`,
        `        Base64.getEncoder().encodeToString(Files.readAllBytes(Path.of(${q(imageFileFor(m.name))})));`,
      );
    }
  }
  const formatted = binary ? `.formatted(${imgs.map((m) => camelVar(m.name)).join(", ")})` : "";
  inner.push(
    `    String body = """`,
    bodyText,
    `        """${formatted};`,
    `    HttpClient client = HttpClient.newHttpClient();`,
    `    HttpRequest req = HttpRequest.newBuilder(URI.create(${q(url)}))`,
    `        .header("Authorization", "Bearer " + System.getenv(${q(ENV)}))`,
    `        .header("Content-Type", "application/json")`,
    `        .POST(HttpRequest.BodyPublishers.ofString(body))`,
    `        .build();`,
    `    HttpResponse<String> res = client.send(req, HttpResponse.BodyHandlers.ofString());`,
    `    System.out.println(res.body());`,
  );
  return [
    ...imports,
    "",
    `public class CreateImage {`,
    `  public static void main(String[] args) throws Exception {`,
    ...inner,
    `  }`,
    `}`,
  ].join("\n");
}

function javaGet(url: string): string {
  return [
    "import java.net.URI;",
    "import java.net.http.HttpClient;",
    "import java.net.http.HttpRequest;",
    "import java.net.http.HttpResponse;",
    "",
    `public class GetExample {`,
    `  public static void main(String[] args) throws Exception {`,
    `    HttpClient client = HttpClient.newHttpClient();`,
    `    HttpRequest req = HttpRequest.newBuilder(URI.create(${q(url)}))`,
    `        .header("Authorization", "Bearer " + System.getenv(${q(ENV)}))`,
    `        .GET()`,
    `        .build();`,
    `    HttpResponse<String> res = client.send(req, HttpResponse.BodyHandlers.ofString());`,
    `    System.out.println(res.body());`,
    `  }`,
    `}`,
  ].join("\n");
}

// ── Dispatch ───────────────────────────────────────────────────────────────

export function snippetHasImages(spec: SnippetSpec): boolean {
  return spec.kind === "createImage" && spec.mods.some((m) => m.type === "image");
}

export function buildSnippet(spec: SnippetSpec, lang: SnippetLang, imageMode: ImageMode = "url"): string {
  if (spec.kind === "get") {
    switch (lang) {
      case "curl": return curlGet(spec.url);
      case "httpie": return httpieGet(spec.url);
      case "ruby": return rbGet(spec.url);
      case "node": return nodeGet(spec.url);
      case "python": return pyGet(spec.url);
      case "java": return javaGet(spec.url);
    }
  }
  switch (lang) {
    case "curl": return curlCreate(spec, imageMode);
    case "httpie": return httpieCreate(spec, imageMode);
    case "ruby": return rbCreate(spec, imageMode);
    case "node": return nodeCreate(spec, imageMode);
    case "python": return pyCreate(spec, imageMode);
    case "java": return javaCreate(spec, imageMode);
  }
}
