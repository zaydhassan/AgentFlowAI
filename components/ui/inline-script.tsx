"use client";

// Inline no-FOUC script helper for Next.js 16 / React 19.
//
// React warns in development when rendering produces a `<script>` tag, because
// scripts injected via React are not executed on the client. To run an inline
// script synchronously during HTML parsing (before first paint) — e.g. to apply
// the persisted theme — without that warning, render a real, executable script
// on the server and an inert `type="text/plain"` tag on the client.
// `suppressHydrationWarning` bridges the `type` attribute mismatch.
//
// - Hard navigation (initial load / refresh): the SSR'd `text/javascript`
//   script runs during HTML parsing, before paint.
// - Client-side navigation: the tag is `text/plain`, so it is ignored.
//
// Reference: node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}