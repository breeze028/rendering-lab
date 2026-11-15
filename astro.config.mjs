import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
export default defineConfig({
  site: 'https://breeze028.github.io',
  base: process.env.PAGES_BASE_PATH || '/rendering-lab/',
  trailingSlash: 'always',
  integrations: [mdx(), react()],
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
    shikiConfig: { theme: 'github-dark' },
  },
  vite: { worker: { format: 'es' }, server: { fs: { allow: ['.'] } } },
  devToolbar: { enabled: false },
});
