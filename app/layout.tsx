import type { Metadata } from "next";
import "./globals.css";
import "./proxy.css";
import "./effects.css";
import "./shop.css";
import "./stat-links.css";
import "./digital.css";
import "./customer-preview.css";
import "./wallet.css";

export const metadata: Metadata = {
  title: "ProxyHub — Proxy & bảo hành 30 ngày",
  description: "Giao diện mua và quản lý proxy HTTP, SOCKS5 cùng bảo hành thay thế 30 ngày.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{__html:"try{var t=localStorage.getItem('proxyhub-theme');if(t==='dark'){document.documentElement.dataset.theme='dark';document.documentElement.classList.add('dark')}}catch(e){}"}}/></head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
