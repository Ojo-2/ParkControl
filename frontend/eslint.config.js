import { defineConfig } from 'vite' 
import react from '@vitejs/plugin-react' 
import tailwindcss from '@tailwindcss/vite' // [suspicious link removed] export default defineConfig({ plugins: [ react(), tailwindcss(), ], })