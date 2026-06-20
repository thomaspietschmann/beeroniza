"use client";

import { useState } from "react";
import {
  SNIPPET_LANGS,
  buildSnippet,
  snippetHasImages,
  type ImageMode,
  type SnippetLang,
  type SnippetSpec,
} from "@/lib/api-snippets";

// Language-switchable, copyable API example. For createImage specs that carry
// image placeholders it also offers a URL / Binary (base64) image-source toggle.
export function ApiSnippet({
  spec,
  initialLang = "curl",
}: {
  spec: SnippetSpec;
  initialLang?: SnippetLang;
}) {
  const [lang, setLang] = useState<SnippetLang>(initialLang);
  const [imageMode, setImageMode] = useState<ImageMode>("url");
  const [copied, setCopied] = useState(false);

  const hasImages = snippetHasImages(spec);
  const code = buildSnippet(spec, lang, imageMode);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="bnz-snippet">
      <div className="bnz-snippet-bar">
        <div className="bnz-snippet-tabs" role="tablist" aria-label="Language">
          {SNIPPET_LANGS.map((l) => (
            <button
              key={l.id}
              type="button"
              role="tab"
              aria-selected={lang === l.id}
              className={`bnz-snippet-tab${lang === l.id ? " active" : ""}`}
              onClick={() => setLang(l.id)}
            >
              {l.label}
            </button>
          ))}
        </div>
        <button type="button" className="bnz-snippet-copy" onClick={copy}>
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      {hasImages && (
        <div className="bnz-snippet-modes">
          <span className="bnz-snippet-modes-label">Image input:</span>
          <button
            type="button"
            className={`bnz-snippet-mode${imageMode === "url" ? " active" : ""}`}
            onClick={() => setImageMode("url")}
          >
            From URL
          </button>
          <button
            type="button"
            className={`bnz-snippet-mode${imageMode === "binary" ? " active" : ""}`}
            onClick={() => setImageMode("binary")}
          >
            Binary (base64)
          </button>
        </div>
      )}

      <pre className="bnz-code-block">
        <code>{code}</code>
      </pre>
    </div>
  );
}
