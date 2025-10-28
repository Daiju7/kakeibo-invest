import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Kakeibo Invest",
  description: "家計簿と投資シミュレーションを組み合わせた学習アプリ",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <div className="appShell">
          <header className="appHeader">
            <div className="navBrand">
              <Link href="/" className="brandLink">Kakeibo Invest</Link>
            </div>
            <nav className="navLinks">
              <Link href="/" className="navLink">家計簿</Link>
              <Link href="/invest" className="navLink">投資シミュレーション</Link>
              <Link href="/register" className="navLink">新規登録</Link>
              <Link href="/login" className="navLink">ログイン</Link>
            </nav>
          </header>
          <main className="appContent">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
