// Native sheets and mobile browsers can keep the layout viewport at its original
// height while the keyboard covers it. Size the chat to the visible viewport,
// including any pan used by iOS to bring the focused textarea into view.
export function observeChatViewport(shell: HTMLElement): () => void {
  const viewport = window.visualViewport;
  let frame: number | null = null;

  function update() {
    frame = null;
    // Pinch zoom should magnify the existing layout, not shrink the chat itself.
    if (viewport && Math.abs(viewport.scale - 1) > 0.01) return;
    const height = viewport?.height ?? window.innerHeight;
    const top = viewport?.offsetTop ?? 0;
    // A backgrounded WebView may temporarily report an empty viewport.
    if (!Number.isFinite(height) || height <= 0 || !Number.isFinite(top)) return;
    shell.style.setProperty("--chat-viewport-height", `${height}px`);
    shell.style.setProperty("--chat-viewport-top", `${Math.max(0, top)}px`);
  }

  function schedule() {
    if (frame === null) frame = window.requestAnimationFrame(update);
  }

  update();
  viewport?.addEventListener("resize", schedule);
  viewport?.addEventListener("scroll", schedule);
  window.addEventListener("resize", schedule);
  window.addEventListener("pageshow", schedule);
  document.addEventListener("focusin", schedule);
  document.addEventListener("focusout", schedule);

  return () => {
    if (frame !== null) window.cancelAnimationFrame(frame);
    viewport?.removeEventListener("resize", schedule);
    viewport?.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
    window.removeEventListener("pageshow", schedule);
    document.removeEventListener("focusin", schedule);
    document.removeEventListener("focusout", schedule);
    shell.style.removeProperty("--chat-viewport-height");
    shell.style.removeProperty("--chat-viewport-top");
  };
}
