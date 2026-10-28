import type { ReactNode } from "react";

export const metadata = {
  title: "Aftersong",
  description: "A reminiscence agent for memory care.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#F3F1EC", color: "#1C1B19", fontFamily: "system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
