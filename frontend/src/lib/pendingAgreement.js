// Crew whose Boat Terms and Conditions are still to accept, so signing out can remind them.
let pending = "";
export const setPendingAgreement = (vessel) => { pending = vessel || ""; };
export const pendingAgreement = () => pending;

// Crew who haven't replied "I'm in" / "Can't make it" yet: signing out asks them first. Holds the reply function.
let rsvp = null;
export const setPendingRsvp = (send) => { rsvp = send || null; };
export const pendingRsvp = () => rsvp;

// A skipper with no Skipper's Phone on their boat is asked for it before signing out. Holds the save function.
let phone = null;
export const setPendingPhone = (save) => { phone = save || null; };
export const pendingPhone = () => phone;
