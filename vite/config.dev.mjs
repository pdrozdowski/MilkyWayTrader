import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
    base: './',
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    phaser: ['phaser']
                }
            }
        },
    },
    server: {
        port: mode === 'test' ? 8081 : 8080,
        strictPort: true
    }
}));
