import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TransitScope – Greater Manchester realtime map',
  description: 'Visualise Greater Manchester buses and trams using free open data feeds.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-stone-100 text-stone-900">
        <div className="min-h-screen flex flex-col">{children}</div>
      </body>
    </html>
  );
}
