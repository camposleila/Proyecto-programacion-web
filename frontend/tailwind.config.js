/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        marino: '#0E1C36', // Prussian Blue
        crema: '#F9FBF2',  // Ivory
        rosa: '#FFA0AC',   // Cotton Candy
        celeste: '#AFCBFF',// Baby Blue Ice
        oliva: '#7B886F'   // Dusty Olive
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] }
    }
  },
  plugins: []
};
