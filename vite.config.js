import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // Configurações adicionais para resolver os problemas
  base: './', // Importante para o roteamento correto
  
  build: {
    rollupOptions: {
      output: {
        // Garante nomes consistentes para os arquivos
        entryFileNames: `assets/[name].[hash].js`,
        chunkFileNames: `assets/[name].[hash].js`,
        assetFileNames: `assets/[name].[hash].[ext]`,
        
        // Configuração para melhor cache
        manualChunks: {
          react: ['react', 'react-dom'],
          router: ['react-router-dom'],
        }
      }
    },
    
    // Otimizações para produção
    minify: 'terser',
    sourcemap: true // Ajuda no debug
  },
  
  server: {
    // Configurações para desenvolvimento
    open: true, // Abre o navegador automaticamente
    port: 3000,
    strictPort: true,
    hmr: {
      overlay: false // Desativa o overlay de erros do HMR
    }
  },
  resolve: {
    alias: {
      '@': '/src', // Alias para facilitar importações
      'react/jsx-runtime': 'react/jsx-runtime.js' // Correção de importação do JSX
    }
  }
});