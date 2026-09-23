import type { SVGProps } from "react";

export type K2IconName =
  | "search" | "cart" | "menu" | "chevron" | "plus" | "minus"
  | "shield" | "truck" | "smile" | "package" | "gear" | "check"
  | "flame" | "clock" | "chart" | "clipboard" | "users" | "grid";

export default function K2Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: K2IconName }) {
  const common = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, ...props };
  if (name === "search") return <svg {...common}><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.2 4.2"/></svg>;
  if (name === "cart") return <svg {...common}><path d="M3 4h2l2.1 10.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L20.5 7H6"/><circle cx="9.5" cy="20" r="1" fill="currentColor"/><circle cx="17" cy="20" r="1" fill="currentColor"/></svg>;
  if (name === "menu") return <svg {...common}><path d="M5 7h14M5 12h14M5 17h14"/></svg>;
  if (name === "chevron") return <svg {...common}><path d="m9 5 7 7-7 7"/></svg>;
  if (name === "plus") return <svg {...common}><path d="M12 5v14M5 12h14"/></svg>;
  if (name === "minus") return <svg {...common}><path d="M5 12h14"/></svg>;
  if (name === "shield") return <svg {...common}><path d="M12 3 20 6v5c0 5.2-3.2 8.3-8 10-4.8-1.7-8-4.8-8-10V6z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg>;
  if (name === "truck") return <svg {...common}><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>;
  if (name === "smile") return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M8.5 14.5c1.7 2 5.3 2 7 0"/><path d="M9 9h.01M15 9h.01" strokeWidth="2.8"/></svg>;
  if (name === "package") return <svg {...common}><path d="m4 7.5 8-4 8 4v9l-8 4-8-4z"/><path d="m4 7.5 8 4 8-4M12 11.5v9M8 5.5l8 4"/></svg>;
  if (name === "gear") return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21h-4v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3.1 14H3v-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.5V3h4v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1v4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>;
  if (name === "check") return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="m8 12 2.6 2.6L16.5 9"/></svg>;
  if (name === "flame") return <svg {...common}><path d="M13.5 3.5c.6 3-1 4.2-2 5.4-1.1-1-1.2-2.2-1-3.1C7.3 8.2 5 11.1 5 14.2a7 7 0 0 0 14 0c0-3.7-2.3-7.4-5.5-10.7Z"/><path d="M12 11.5c-1.8 1.6-2.6 2.8-2.6 4.2a2.6 2.6 0 0 0 5.2 0c0-1.4-.8-2.8-2.6-4.2Z"/></svg>;
  if (name === "clock") return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>;
  if (name === "chart") return <svg {...common}><path d="M5 19V9M12 19V4M19 19v-7"/></svg>;
  if (name === "clipboard") return <svg {...common}><rect x="5" y="5" width="14" height="16" rx="2"/><path d="M9 5V3h6v2M8.5 10h7M8.5 14h7M8.5 18h4"/></svg>;
  if (name === "users") return <svg {...common}><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3.5 20c0-4 2-6 5.5-6s5.5 2 5.5 6M14 15c3.8-.8 6.5 1.1 6.5 5"/></svg>;
  return <svg {...common}><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg>;
}
