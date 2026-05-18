/*
this file is responsible for:
  - global html structure
  - global styles/fonts
  - pwa metadata config
  - service worker configuration
  - shared page background/theme styling
*/

import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

//font to be used in application
const inter = Inter({subsets: ["latin"]});

//instabilitiy, app name, icons and mobile behavior
export const metadata: Metadata = {
  title: "JobPulse - Track your Job Applications",
  description: "Hit your daily job application targets with AI tracking",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "JobPulse",
  },
  icons: {
    icon: [{ url: "/icons/icon-192x192.png" }],
    apple: [{ url: "/icons/icon-192x192.png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en" 
      suppressHydrationWarning
    >
      <head>
        {/* Register the service worker for push notifications */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(reg => console.log('SW registered'))
                    .catch(err => console.warn('SW registered failed', err));
                });
              }
            `,
          }}
        />
      </head>
        <body 
        className={`${inter.className} bg-gray-950 text-gray-100 min-h-screen`}>
          {children}
        </body>
    </html>
  );
}
