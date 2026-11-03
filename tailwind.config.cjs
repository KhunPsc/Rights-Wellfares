// Tailwind สร้าง CSS ตอน npm run build:sites — สแกนเฉพาะ class ที่ใช้จริง (เดิมโหลดจาก cdn.tailwindcss.com ทุกหน้า)
// clauses.json / wizard.json มี HTML พร้อม class ฝังอยู่ (แสดงผลตอนรันจากข้อมูล bootstrap) จึงต้องสแกนด้วย
module.exports = {
  content: ['./src/sites/**/*.{html,js}', './src/data/*.json'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Sarabun', 'sans-serif'],
        heading: ['Prompt', 'sans-serif'],
      },
      colors: {
        pea: {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
          700: '#742284',
          800: '#5b1968',
          900: '#3f1049',
          gold: '#f59e0b',
          goldLight: '#fef3c7',
        },
      },
    },
  },
};
