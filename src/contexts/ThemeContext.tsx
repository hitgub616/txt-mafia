import { createContext, useContext, useState, useEffect } from 'react';
import { GamePhase } from '../types/game';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  setTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children, phase }: { children: React.ReactNode; phase: GamePhase }) => {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    // 페이즈에 따라 테마 변경
    const newTheme = phase === 'night' ? 'dark' : 'light';
    setTheme(newTheme);
    
    // 테마 변경 시 body 클래스 업데이트
    document.body.classList.remove('light-theme', 'dark-theme');
    document.body.classList.add(`${newTheme}-theme`);
  }, [phase]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}; 