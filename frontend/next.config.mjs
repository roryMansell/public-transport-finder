function normalizeBasePath(value) {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim().replace(/^\/+|\/+$/g, '');
  if (!trimmed) {
    return '';
  }

  return `/${trimmed}`;
}

function resolveBasePath() {
  if (typeof process.env.NEXT_PUBLIC_BASE_PATH !== 'undefined') {
    return normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);
  }

  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository) {
    return undefined;
  }

  const [, repo] = repository.split('/');
  if (!repo || repo.endsWith('.github.io')) {
    return undefined;
  }

  return normalizeBasePath(repo);
}

const computedBasePath = resolveBasePath();
const basePath = computedBasePath && computedBasePath.length > 0 ? computedBasePath : undefined;

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true
  },
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  }
};

if (basePath) {
  nextConfig.basePath = basePath;
  nextConfig.assetPrefix = `${basePath}/`;
}

export default nextConfig;
