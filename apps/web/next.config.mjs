/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  distDir: 'out',
  // Custom domain (iwpc.silurus.dev) hosts the site at the root, so no
  // basePath is needed even when deployed to GitHub Pages.
  // Trailing slashes keep relative URLs (./child) resolving inside the
  // current segment instead of climbing up — important for nested demo
  // routes like /dialog/broadcast/ opening ./child.
  trailingSlash: true,
  images: {
    unoptimized: true
  }
};

export default nextConfig;
