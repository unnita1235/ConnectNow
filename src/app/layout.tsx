import type {Metadata} from 'next';
import './globals.css';
import { cn } from "@/lib/utils";
import { SessionProvider } from "@/components/providers/session-provider";

export const metadata: Metadata = {
  title: 'ConnectNow',
  description: 'Real-time communication, reimagined.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className={cn("font-body antialiased", "min-h-screen bg-background font-sans")}>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
