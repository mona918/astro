/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        radio: {
          dark: '#0d1117',
          panel: '#161b22',
          body: '#1f242d',
          bezel: '#282e3a',
          accent: '#384252',
          screen: '#121815',
          lcd: '#0e1c14',
          'lcd-text': '#38ef7d',
          'lcd-dim': '#1b5e38',
          ptt: '#d92727',
          'ptt-hover': '#e63939',
          'ptt-active': '#b71c1c',
          amber: '#f59e0b',
          military: '#4a5d4e',
        }
      },
      fontFamily: {
        mono: ['"Share Tech Mono"', 'Consolas', 'Courier New', 'monospace'],
        display: ['"Chakra Petch"', 'Rajdhani', 'sans-serif'],
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'ping-slow': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
      }
    },
  },
  plugins: [],
}
