import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // WSL /mnt/c(Windows 드라이브)에서는 fs.watch가 동작하지 않아 HMR이 파일 변경을 놓친다.
    // 폴링으로 강제해 새 파일/수정이 즉시 반영되게 한다(이전 'stale vite' 문제 해결).
    watch: { usePolling: true, interval: 300 },
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        // changeOrigin=true: Host 헤더를 target으로 변경.
        // 백엔드 resolve_public_url가 vite dev origin(5173) 대신 8000을 보게 한다.
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
