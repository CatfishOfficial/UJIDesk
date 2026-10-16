import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Every variable (.env files and the host's), not just VITE_ ones. Tests run without them,
  // so accounts stay off there whatever this computer has set.
  const env: Record<string, string | undefined> = mode === 'test' ? {} : { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  return {
    plugins: [react()],
    // The Supabase project URL and publishable key are public by design (row-level security
    // guards the data), so they're baked into the page, but by exact name rather than through
    // a VITE_ prefix: nothing else in the environment, secret keys included, can ride along.
    define: {
      __SUPABASE_URL__: JSON.stringify(env.SUPABASE_URL ?? ''),
      __SUPABASE_PUBLISHABLE_KEY__: JSON.stringify(env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || ''),
    },
    test: { environment: 'node', include: ['src/**/*.test.ts'] },
  };
}) as never;
