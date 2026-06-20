"use client";

import { useEffect, useState } from "react";
import {
  renderTemplateToDataURL,
  type RenderOptions,
} from "@/lib/template/fabric-render";
import type { Modification, TemplateDoc } from "@/lib/template/schema";

// Exposes window.__bnzRender for the Playwright-driven server renderer. This
// runs the identical Fabric code + bundled @font-face fonts as the editor.
export function RenderBridge() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const w = window as unknown as {
      __bnzRender?: (
        doc: TemplateDoc,
        mods: Modification[],
        opts?: RenderOptions,
      ) => Promise<string>;
    };
    w.__bnzRender = (doc, mods, opts) =>
      renderTemplateToDataURL(doc, mods, opts);
    setReady(true);
    return () => {
      delete w.__bnzRender;
    };
  }, []);

  return (
    <div id="bnz-render-ready" data-ready={ready}>
      Beeroniza render bridge
    </div>
  );
}
