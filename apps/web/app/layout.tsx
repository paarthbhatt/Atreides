import type { Metadata } from "next";
import "./globals.css";
import "./flow.css";
import "./judge.css";
import "./responsive.css";

export const metadata: Metadata = {
  title: "Atreides - Proof-carrying MCP security",
  description: "The enforceable trust boundary for AI agents and MCP tools.",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
