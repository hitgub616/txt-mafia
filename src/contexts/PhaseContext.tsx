import { createContext, useContext } from 'react';
import { GamePhase } from '../types/game';

export const PhaseContext = createContext<GamePhase>('waiting');

export const usePhase = () => useContext(PhaseContext); 