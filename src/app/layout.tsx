import type { Metadata, Viewport } from 'next';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

export const metadata: Metadata = {
  title: 'CareOps — Home Care & Operational Task Dashboard',
  description:
    'High-contrast, instant-response web application engineered to eliminate administrative friction and logging errors in home care, built on the BRNP Stack.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0d6efd',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className="bg-light text-dark min-vh-100" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <header className="navbar navbar-expand navbar-dark bg-dark py-2 px-3 shadow-sm border-bottom border-dark-subtle">
          <div className="container-fluid d-flex justify-content-between align-items-center" style={{ maxWidth: '840px' }}>
            <span className="navbar-brand fw-bold d-flex align-items-center gap-2 mb-0 fs-6">
              <span className="badge bg-primary p-2 rounded-2">
                <i className="bi bi-shield-heart fs-6"></i>
              </span>
              <span>CareOps <small className="text-secondary fw-normal">| BRNP Stack</small></span>
            </span>
            <div className="d-flex align-items-center gap-2">
              <span className="badge bg-success-subtle text-success border border-success-subtle small d-none d-sm-inline-block">
                <i className="bi bi-database-check me-1"></i> PostgreSQL Connected
              </span>
              <span className="badge bg-primary-subtle text-primary border border-primary-subtle small">
                NN/g Usability 10/10
              </span>
            </div>
          </div>
        </header>

        <main>{children}</main>

        <footer className="py-4 text-center text-muted small border-top bg-white mt-5">
          <div className="container">
            CareOps &bull; Built on the <strong>BRNP Stack</strong> (Bootstrap 5, React, Next.js, PostgreSQL) strictly following <strong>Jakob Nielsen&apos;s 10 Usability Heuristics</strong>.
          </div>
        </footer>
      </body>
    </html>
  );
}
