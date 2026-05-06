/**
 * Root passthrough.
 *
 * The actual <html>/<body> shell lives in:
 *   - src/app/[locale]/layout.tsx — public, locale-aware
 *   - src/app/admin/layout.tsx     — admin, locale-agnostic
 *
 * This split lets next-intl own the public tree without forcing the locale
 * provider onto admin routes.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
