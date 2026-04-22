import { defineConfig } from 'vite'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  // ตั้งค่า Base สำคัญมากสำหรับรันบน GitHub Pages (ชื่อ repository ของคุณ)
  base: '/gunshadelivery/',
  publicDir: 'image', // กำหนดให้โฟลเดอร์ image เป็นโฟลเดอร์ public
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
        accessories: resolve(__dirname, 'accessories.html'),
      },
    },
  },
})
