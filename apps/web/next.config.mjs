/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  distDir: 'out',
  images: {
    unoptimized: true
  },
  basePath: process.env.GITHUB_PAGES ? '/<REPO_NAME>' : ''
};

export default nextConfig;
