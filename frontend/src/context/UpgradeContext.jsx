import { createContext, useCallback, useContext, useState } from "react";
import { PlanDialog } from "@/components/boat/PlanDialog";

const UpgradeContext = createContext(null);

export function UpgradeProvider({ children }) {
  const [plan, setPlan] = useState(null);
  const askUpgrade = useCallback((reason) => setPlan({ reason }), []);
  const openPlan = useCallback(() => setPlan({ reason: null }), []);
  return (
    <UpgradeContext.Provider value={{ askUpgrade, openPlan }}>
      {children}
      <PlanDialog open={!!plan} reason={plan?.reason} onClose={() => setPlan(null)} />
    </UpgradeContext.Provider>
  );
}

export const useUpgrade = () => useContext(UpgradeContext);
