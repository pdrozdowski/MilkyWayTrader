import { defineConfig } from 'vite';

export default defineConfig({
    base: './',
    define: {
        'import.meta.env.VITE_GAME_VERSION': JSON.stringify(process.env.VITE_GAME_VERSION ?? process.env.npm_package_version ?? '0.0.0')
    },
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
        port: 8080
    }
});
