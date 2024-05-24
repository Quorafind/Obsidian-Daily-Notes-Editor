import path from 'path';
import {defineConfig} from 'vite';
import {svelte} from '@sveltejs/vite-plugin-svelte';
import autoPreprocess from 'svelte-preprocess';
import terser from '@rollup/plugin-terser';
import replace from '@rollup/plugin-replace';
import resolve from '@rollup/plugin-node-resolve';

const prod = (process.argv[4] === 'production');

export default defineConfig(({mode}) => {
    return {
        plugins: [
            svelte({
                preprocess: autoPreprocess()
            })
        ],
        build: {
            sourcemap: mode === 'development' ? 'inline' : false,
            minify: mode !== 'development',
            // Use Vite lib mode https://vitejs.dev/guide/build.html#library-mode
            lib: {
                entry: path.resolve(__dirname, './src/dailyNoteViewIndex.ts'),
                formats: ['cjs'],
            },
            rollupOptions: {
                plugins: [
                    mode === 'development'
                        ? ''
                        : terser({
                            compress: {
                                defaults: false,
                                drop_console: ['log', 'info'],
                            },
                            mangle: {
                                eval: true,
                                module: true,
                                toplevel: true,
                                safari10: true,
                                properties: false,
                            },
                            output: {
                                comments: false,
                                ecma: '2020',
                            },
                        }),
                    resolve({
                        browser: false,
                    }),
                    replace({
                        preventAssignment: true,
                        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
                    }),
                ],
                output: {
                    // Overwrite default Vite output fileName
                    entryFileNames: 'main.js',
                    assetFileNames: 'styles.css',
                },
                external: [
                    'obsidian',
                    'electron',
                    '@codemirror/autocomplete',
                    '@codemirror/collab',
                    '@codemirror/commands',
                    '@codemirror/language',
                    '@codemirror/lint',
                    '@codemirror/search',
                    '@codemirror/state',
                    '@codemirror/view',
                    '@lezer/common',
                    '@lezer/highlight',
                    '@lezer/lr',
                ],
            },
            // Use root as the output dir
            emptyOutDir: false,
            outDir: '.',
        },
    };
});
