import { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';

// Constantes para padronização
const THEME_LIGHT = 'light';
const THEME_DARK = 'dark';
const THEME_SYSTEM = 'system';
const THEME_LOCALSTORAGE_KEY = 'secret-confessions-theme';

// Tipos de tema para autocompletar e validação
const ThemeTypes = {
  LIGHT: THEME_LIGHT,
  DARK: THEME_DARK,
  SYSTEM: THEME_SYSTEM
};

// Cores base para cada tema
const ThemeColors = {
  [THEME_LIGHT]: {
    '--primary-color': '#6a0dad',
    '--secondary-color': '#ffffff',
    '--accent-color': '#9c27b0',
    '--text-color': '#333333',
    '--text-secondary': '#666666',
    '--card-bg': '#f8f9fa',
    '--input-bg': '#ffffff',
    '--warning-color': '#d32f2f',
    '--success-color': '#2e7d32',
    '--border-color': '#e0e0e0'
  },
  [THEME_DARK]: {
    '--primary-color': '#9c27b0',
    '--secondary-color': '#121212',
    '--accent-color': '#ba68c8',
    '--text-color': '#f5f5f5',
    '--text-secondary': '#bbbbbb',
    '--card-bg': '#1e1e1e',
    '--input-bg': '#2d2d2d',
    '--warning-color': '#f44336',
    '--success-color': '#4caf50',
    '--border-color': '#444444'
  }
};

// Contexto com valor inicial completo
const ThemeContext = createContext({
  theme: THEME_DARK,
  isDarkMode: true,
  themeColors: ThemeColors[THEME_DARK],
  toggleTheme: () => {},
  setTheme: () => {},
  ThemeTypes,
  ThemeColors
});

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    try {
      // Tenta recuperar o tema do localStorage ou usa o preferido do sistema
      const savedTheme = localStorage.getItem(THEME_LOCALSTORAGE_KEY);
      if ([THEME_LIGHT, THEME_DARK, THEME_SYSTEM].includes(savedTheme)) {
        return savedTheme;
      }
      
      // Fallback para preferência do sistema
      return THEME_SYSTEM;
    } catch (error) {
      console.error('Error reading theme preference:', error);
      return THEME_SYSTEM;
    }
  });

  // Determina o tema efetivo (resolve 'system' para light/dark)
  const effectiveTheme = useMemo(() => {
    if (theme === THEME_SYSTEM) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches 
        ? THEME_DARK 
        : THEME_LIGHT;
    }
    return theme;
  }, [theme]);

  const isDarkMode = effectiveTheme === THEME_DARK;

  // Aplica as variáveis CSS no root
  useEffect(() => {
    const root = document.documentElement;
    const colors = ThemeColors[effectiveTheme];
    
    Object.entries(colors).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    // Adiciona classe ao body para estilos específicos
    document.body.classList.remove(THEME_LIGHT, THEME_DARK);
    document.body.classList.add(effectiveTheme);
  }, [effectiveTheme]);

  // Observa mudanças na preferência do sistema quando theme === 'system'
  useEffect(() => {
    if (theme !== THEME_SYSTEM) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => {
      const newEffectiveTheme = e.matches ? THEME_DARK : THEME_LIGHT;
      document.body.classList.remove(THEME_LIGHT, THEME_DARK);
      document.body.classList.add(newEffectiveTheme);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme]);

  // Alterna entre light/dark/system
  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      let newTheme;
      if (prev === THEME_DARK) newTheme = THEME_LIGHT;
      else if (prev === THEME_LIGHT) newTheme = THEME_SYSTEM;
      else newTheme = THEME_DARK;
      
      try {
        localStorage.setItem(THEME_LOCALSTORAGE_KEY, newTheme);
      } catch (error) {
        console.error('Error saving theme preference:', error);
      }
      
      return newTheme;
    });
  }, []);

  // Permite definir o tema diretamente
  const setThemeDirectly = useCallback((newTheme) => {
    if ([THEME_LIGHT, THEME_DARK, THEME_SYSTEM].includes(newTheme)) {
      setTheme(newTheme);
      try {
        localStorage.setItem(THEME_LOCALSTORAGE_KEY, newTheme);
      } catch (error) {
        console.error('Error saving theme preference:', error);
      }
    }
  }, []);

  // Valor do contexto
  const value = useMemo(() => ({
    theme,
    isDarkMode,
    themeColors: ThemeColors[effectiveTheme],
    toggleTheme,
    setTheme: setThemeDirectly,
    ThemeTypes,
    ThemeColors,
    effectiveTheme
  }), [theme, isDarkMode, effectiveTheme, toggleTheme, setThemeDirectly]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

// Hook personalizado com verificação
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};