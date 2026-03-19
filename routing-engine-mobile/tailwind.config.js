// tailwind.config.js
module.exports = {
  presets: [require("nativewind/preset")],
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#4CAF50',
          light: '#E8F5E9',
          dark: '#388E3C',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          muted: '#F9FAFB',
          dark: '#1A1A2E',
        },
        text: {
          DEFAULT: '#1F2937',
          secondary: '#6B7280',
          muted: '#9CA3AF',
          label: '#4CAF50',
        },
        border: {
          DEFAULT: '#E5E7EB',
          light: '#F3F4F6',
        },
      },
      borderRadius: {
        'card': '16px',
        'button': '12px',
        'input': '12px',
      },
    },
  },
  plugins: [],
}