/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./views/**/*.ejs", "./public/**/*.js"],
  theme: {
    extend: {
      colors: {
        brandYellow: "#FFD700", // Adjust based on your design
        brandBlack: "#000000",
      },
    },
  },
  plugins: [],
};


