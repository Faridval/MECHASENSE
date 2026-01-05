import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Mechasense Brand Colors
        primary: {
          DEFAULT: '#1B3C53',
          dark: '#0f2838',
          light: '#234C6A',
        },
        secondary: {
          DEFAULT: '#234C6A',
          light: '#456882',
        },
        accent: '#456882',
        lightgray: '#E3E3E3',
        // Status Colors
        status: {
          normal: '#10b981',   // green-500
          warning: '#f59e0b',  // amber-500
          critical: '#ef4444', // red-500
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;

