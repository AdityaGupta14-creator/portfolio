/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: 'var(--color-accent)',
          hover: 'var(--color-accent-hover)',
        },
        slate: {
          950: '#020617',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'sans-serif'],
        display: ['var(--font-display)', 'sans-serif'],
      },
      borderRadius: {
        glass: 'var(--glass-radius)',
      },
      boxShadow: {
        glass: 'var(--glass-shadow)',
      },
      backdropBlur: {
        glass: 'var(--glass-blur)',
      },
    },
  },
  plugins: [],
};

