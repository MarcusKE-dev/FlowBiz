/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Sora"', 'system-ui', 'sans-serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: {
          50: '#f5f6f7', 100: '#e8eaed', 200: '#cfd3da',
          300: '#a6adb9', 400: '#767f8f', 500: '#5a6273',
          600: '#454b5c', 700: '#363b48', 800: '#262a34',
          900: '#15171d', 950: '#0c0d11',
        },
        moss: {
          50: '#f1faf4', 100: '#dcf3e3', 200: '#bbe6c9',
          300: '#8ad2a6', 400: '#54b67c', 500: '#2f9a5e',
          600: '#1f7c4a', 700: '#1a623c', 800: '#194e33', 900: '#16412c',
        },
        rust: {
          50: '#fdf4ef', 100: '#fbe5d9', 200: '#f6c8ae',
          300: '#efa278', 400: '#e87a48', 500: '#dd5a28',
          600: '#c4441d', 700: '#a2331b', 800: '#822b1c', 900: '#6a261b',
        },
        sand: '#faf6ef',
      },
      borderRadius: { xl2: '1.1rem' },
      minHeight: { touch: '44px' },
      minWidth:  { touch: '44px' },
    },
  },
  plugins: [],
};
