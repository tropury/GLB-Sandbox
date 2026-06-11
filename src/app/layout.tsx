import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "Web3D - 3D Material Viewer",
  description: "Online 3D viewer for material swapping on objects. Explore different fabrics and metals in real time. AR supported.",
  keywords: ["3D", "viewer", "materials", "sofa", "WebGL", "Three.js", "texture swap", "AR", "augmented reality"],
  authors: [{ name: "Web3D Viewer" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "Web3D - 3D Material Viewer",
    description: "Online 3D viewer with AR support. Explore different fabrics in real time.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Web3D - 3D Material Viewer",
    description: "Online 3D viewer with AR support.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
