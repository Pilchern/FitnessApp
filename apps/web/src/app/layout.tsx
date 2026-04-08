import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fitness App",
  description:
    "Modular health, fitness, recovery, body-composition, and journaling workspace.",
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
