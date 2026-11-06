import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()],base:process.env.VITE_BASE_PATH||'/STARSIS/',build:{target:'es2022'},server:{host:'0.0.0.0',allowedHosts:['terminal.local'],proxy:{'/gateway':{target:'https://startsys-production.up.railway.app',changeOrigin:true,headers:{Origin:'https://delta-1.github.io'},rewrite:path=>path.replace(/^\/gateway/,'')}}}});
