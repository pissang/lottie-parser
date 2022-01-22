import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    hmr: false,
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/main.ts'),
      name: 'lottieParser',
      fileName: (format) =>
        format === 'umd' ? `lottie-parser.js` : `lottie-parser.${format}.js`,
    },
    rollupOptions: {},
  },
  resolve: {
    // alias: {
    //   echarts: '/Users/lang/Develop/echarts',
    //   zrender: '/Users/lang/Develop/zrender',
    // },
  },
});
