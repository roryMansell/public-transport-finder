import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bus: '#005CAB',
        tram: '#FFCD00'
      }
    }
  },
  plugins: []
};

export default config;
