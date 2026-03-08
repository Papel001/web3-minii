// src/app/layout.tsx
import "./globals.css";

export const metadata = {
  title: "BlockDAG",
  description: "BlockDAG Web3 App",
  icons: {
    icon: "/favicon.svg",
  },
};

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
