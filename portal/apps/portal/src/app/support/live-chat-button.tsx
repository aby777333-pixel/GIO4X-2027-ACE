"use client";

// Triggers the global LiveChatWidget (mounted in the root layout) to open.
export function LiveChatButton({ label = "Start chat" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("gio4x:open-chat"))}
      className="mt-3 text-xs font-medium text-sky hover:underline"
    >
      {label} →
    </button>
  );
}
