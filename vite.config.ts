/*
  three 를 앱 코드와 다른 파일로 떼어 둔다.

  전체 내려받는 양은 그대로다 — 뽑기 화면을 안 열어도 받는다는 점은 변하지 않는다.
  대신 앱 코드는 자주 바뀌고 three 는 거의 안 바뀌므로, 나눠 두면 배포할 때마다
  사용자가 three(약 130KB gzip)를 다시 받지 않는다. 캐시가 살아 있는 쪽을 늘리는 것이 목적이다.
*/
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },
});
