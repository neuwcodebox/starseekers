import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Starseekers",
  description:
    "GitHub 별표한 저장소를 의미 기반으로 검색할 수 있는 실험적 도구",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <Providers>
          <main className="app-shell">
            <header className="app-header">
              <div className="logo">Starseekers</div>
              <p className="tagline">깃헙 별표 저장소 의미 검색</p>
            </header>
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
