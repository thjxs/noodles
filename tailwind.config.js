const colors = require('tailwindcss/colors')

module.exports = {
  mode: 'jit',
  purge: ['./src/**/*.njk'],
  darkMode: false, // or 'media' or 'class'
  theme: {
    extend: {},
    colors: colors
  },
  variants: {
    extend: {},
  },
  plugins: [],
}
