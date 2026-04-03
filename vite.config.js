import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  // ตั้งค่า Base สำคัญมากสำหรับรันบน GitHub Pages (ชื่อ repository ของคุณ)
  base: '/gunshadelivery/',
  publicDir: 'image', // กำหนดให้โฟลเดอร์ image เป็นโฟลเดอร์ public
})
