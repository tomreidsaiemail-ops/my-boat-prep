// Crew whose Boat Terms and Conditions are still to accept, so signing out can remind them.
let pending = "";
export const setPendingAgreement = (vessel) => { pending = vessel || ""; };
export const pendingAgreement = () => pending;
