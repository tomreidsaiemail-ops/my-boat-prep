import { createContext, useContext } from "react";

export const WeightsContext = createContext(null);
export const useWeights = () => useContext(WeightsContext);
