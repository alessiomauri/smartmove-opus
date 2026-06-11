/**
 * Clipboard plumbing for the copy-card-to-email workflow.
 *
 * Writes BOTH text/html and text/plain via ClipboardItem so pasting
 * into Gmail/Apple Mail/Outlook web yields the rendered card, while
 * plain-text targets get the readable fallback.
 *
 * The builder runs server-side (server action) — we hand ClipboardItem
 * *promises* of blobs so the clipboard write starts inside the user
 * gesture (Chrome's transient-activation rule) while the HTML is still
 * being built.
 */
export async function copySelectionToClipboard(
  build: () => Promise<{ html: string; text: string; count: number }>
): Promise<number> {
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    let count = 0;
    const result = build().then((r) => {
      count = r.count;
      return r;
    });
    const item = new ClipboardItem({
      'text/html': result.then((r) => new Blob([r.html], { type: 'text/html' })),
      'text/plain': result.then((r) => new Blob([r.text], { type: 'text/plain' })),
    });
    await navigator.clipboard.write([item]);
    await result;
    return count;
  }

  // Fallback (older browsers): plain text only.
  const r = await build();
  await navigator.clipboard.writeText(r.text);
  return r.count;
}
