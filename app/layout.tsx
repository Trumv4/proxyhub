import type { Metadata } from "next";
import "./globals.css";
import "./proxy.css";
import "./effects.css";
import "./shop.css";
import "./stat-links.css";
import "./digital.css";
import "./customer-preview.css";
import "./wallet.css";
import "./marketplace.css";

export const metadata: Metadata = {
  title: "Tạp Hóa VIP — Cửa hàng sản phẩm số",
  description: "Cửa hàng tài khoản, key, proxy và sản phẩm số. Thanh toán qua ví, theo dõi đơn hàng và hỗ trợ qua Zalo.",
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
