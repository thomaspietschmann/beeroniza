import "@/styles/main.scss";
import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  themeColor: "#161427",
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3939"),
  title: {
    default: "Beeroniza",
    template: "%s · Beeroniza",
  },
  description:
    "Self-hosted image generation from visual templates — web editor and REST API.",
  openGraph: {
    title: "Beeroniza",
    description: "Self-hosted image generation from visual templates — web editor and REST API.",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Beeroniza",
    description: "Self-hosted image generation from visual templates — web editor and REST API.",
    images: ["/og-image.png"],
  },
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
  },
  appleWebApp: {
    capable: true,
    title: "Beeroniza",
    statusBarStyle: "black-translucent",
  },
  other: {
    "msapplication-TileColor": "#161427",
    "msapplication-TileImage": "/mstile-150x150.png",
    "msapplication-config": "/browserconfig.xml",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
