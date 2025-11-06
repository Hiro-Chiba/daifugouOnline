import './globals.css';
import type { Metadata } from 'next';
import { Noto_Sans_JP } from 'next/font/google';

const notoSans = Noto_Sans_JP({ subsets: ['latin'], weight: ['400', '500', '700'] });

export const metadata: Metadata = {
  title: '大富豪オンライン',
  description: 'Pusher と Prisma を活用した大富豪オンライン対戦アプリ'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className={notoSans.className}>
        <div className="app-shell">
          <header className="app-header">
            <div className="logo">🃏 大富豪オンライン</div>
          </header>
          <main className="app-main">{children}</main>
          <footer className="app-footer">&copy; {new Date().getFullYear()} 大富豪オンライン</footer>
        </div>
      </body>
    </html>
  );
}
