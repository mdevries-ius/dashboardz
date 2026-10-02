import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("http://localhost:3000"),
  title: "GMA Monthly Performance — Operations",
  description: "Genesis national and regional inventory, share of inventory, retail share, and model performance.",
  openGraph: {
    title: "GMA Monthly Performance — Operations",
    description: "Genesis national and regional inventory, SOI, SOM, and model performance.",
    images: [{ url: "/og.png", width: 1733, height: 907, alt: "GMA Monthly Performance operations dashboard" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "GMA Monthly Performance — Operations",
    description: "Genesis national and regional inventory, SOI, SOM, and model performance.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
