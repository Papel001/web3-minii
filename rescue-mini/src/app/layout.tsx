// src/app/layout.tsx
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
            <head>
        <link rel="stylesheet" href="/css/bundle.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
