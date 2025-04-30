import { createContext } from 'react';

export type GamePhase = 'waiting' | 'day' | 'night';

export const PhaseContext = createContext<GamePhase>('waiting'); 