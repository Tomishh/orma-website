// @ts-check
import { defineConfig, envField } from 'astro/config';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  site: 'https://orma.tomish.fr',
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  server: { host: true, port: 4321 },
  // Trust X-Forwarded-* headers from the apache reverse proxy for this domain
  security: { allowedDomains: [{ hostname: 'orma.tomish.fr', protocol: 'https' }] },
  env: {
    schema: {
      // Read at runtime, so the same image works in every environment
      STRAPI_URL: envField.string({ context: 'server', access: 'secret', default: 'http://localhost:1337' }),
      STRAPI_TOKEN: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
});
