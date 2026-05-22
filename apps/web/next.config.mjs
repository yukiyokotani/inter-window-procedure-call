/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  distDir: 'out',
  // Custom domain (iwpc.silurus.dev) hosts the site at the root, so no
  // basePath is needed even when deployed to GitHub Pages.
  images: {
    unoptimized: true
  }
};

export default nextConfig;
