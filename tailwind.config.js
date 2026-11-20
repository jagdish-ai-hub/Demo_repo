/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#dce7fd',
          500: '#3559c7',
          600: '#2a47a8',
          700: '#213a87',
        },
      },
    },
  },
  plugins: [],
};
