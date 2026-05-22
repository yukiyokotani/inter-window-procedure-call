import type { Metadata } from 'next';
import localFont from 'next/font/local';

import './globals.css';

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans'
});
const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono'
});

export const metadata: Metadata = {
  title: 'IWPC — Inter-Window Procedure Call',
  description:
    'Type-safe RPC between browser windows over postMessage or BroadcastChannel.'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en' className='dark'>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans min-h-screen bg-background`}
      >
        {children}
      </body>
    </html>
  );
}
