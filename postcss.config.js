import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

console.log('Loading PostCSS config...');
console.log('Tailwind loaded:', !!tailwindcss);
console.log('Autoprefixer loaded:', !!autoprefixer);

export default {
    plugins: [
        tailwindcss,
        autoprefixer,
    ],
};