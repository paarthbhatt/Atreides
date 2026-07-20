import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Atreides — Proof-carrying MCP security",
  description: "The enforceable trust boundary for AI agents and MCP tools.",
  icons: { icon: "/icon.svg" }
};

export const viewport: Viewport = { themeColor: "#080907" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
