import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Look for Structure! · Snap-Cube Robots",
  description:
    "An interactive Grade 2 math animation about looking for and making use of structure with base-ten snap cubes, with an optional Grade 3 array bonus.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fff8ec",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
