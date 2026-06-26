/**
 * Visually-hidden polite live region for announcing async status changes
 * (uploading / generating / rendering / copied) to screen readers. Keep one
 * mounted and change its `message` prop; assistive tech announces the new text.
 * WCAG 4.1.3 (Status Messages).
 */
export function LiveStatus({ message }: { message: string }) {
  return (
    <span role="status" aria-live="polite" aria-atomic="true" className="visually-hidden">
      {message}
    </span>
  );
}
