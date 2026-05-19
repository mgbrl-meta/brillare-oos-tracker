import "./globals.css";

export const metadata = {
  title: "Brillare OOS Tracker",
  description: "Multi-platform product inventory dashboard"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
