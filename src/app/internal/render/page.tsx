import { RenderBridge } from "./RenderBridge";

// Internal page used only by the server-side renderer (headless Chromium).
// It pulls in the global stylesheet (and thus the bundled @font-face fonts)
// via the root layout, then exposes window.__bnzRender.
export const dynamic = "force-dynamic";

export default function InternalRenderPage() {
  return <RenderBridge />;
}
