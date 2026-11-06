export const APP_URL = "https://myboatprep.com";

export const CREW_FIELDS = [
  { k: "name", label: "Name", max: 60, placeholder: "e.g. Tom Smith" },
  { k: "phone", label: "Phone number", type: "tel", max: 30, placeholder: "+64 21 555 1234" },
  { k: "email", label: "Email", type: "email", max: 254, placeholder: "crew@email.com" },
  { k: "dob", label: "Date of birth", type: "date" },
  { k: "height_cm", label: "Height (cm)", type: "number", placeholder: "180" },
  { k: "weight_kg", label: "Weight (kg)", type: "number", placeholder: "82" },
  { k: "allergies", label: "Allergies", area: true, max: 500, placeholder: "List them, or type None" },
  { k: "food", label: "Food preferences", area: true, max: 500, placeholder: "e.g. vegetarian, no seafood, or None" },
  { k: "nok_name", label: "Next of kin name", max: 60, placeholder: "e.g. Jane Smith" },
  { k: "nok_email", label: "Next of kin email", type: "email", max: 254, placeholder: "family@email.com" },
  { k: "nok_phone", label: "Next of kin phone number", type: "tel", max: 30, placeholder: "+64 21 555 6789" },
  { k: "comments", label: "General comments", area: true, max: 1000, placeholder: "Experience, medical notes, anything the skipper should know, or None" },
];

export const PARTY_FIELDS = CREW_FIELDS.slice(0, 3);

export const toForm = (e = {}) => Object.fromEntries(CREW_FIELDS.map(({ k }) => [k, e[k] == null ? "" : String(e[k])]));

export const toPayload = (v, fields = CREW_FIELDS) => Object.fromEntries(fields.map(({ k, type }) => [k, type === "number" ? (String(v[k]).trim() === "" ? null : Number(v[k])) : String(v[k] || "").trim()]));

export const missing = (v, fields = CREW_FIELDS) => fields.filter(({ k }) => !String(v[k] ?? "").trim()).map(({ k }) => k);

export const requestMessage = ({ name, skipper, email }) => [
  `*Hi ${name}, please complete your crew registration*`,
  `${skipper} has asked you to register as crew on My Boat Prep. You only do this once.`,
  `\nOpen My Boat Prep: ${APP_URL}`,
  `Sign up or log in with ${email} and the app will show your registration form.`,
  `\n*When you're done, text me to say you've completed your registration.*`,
].join("\n");

export const waLink = (phone, text) => {
  const digits = String(phone || "").replace(/[^\d]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
};

export const STATUS = {
  registered: { label: "Registered", cls: "bg-green-100 text-green-800" },
  pending: { label: "Pending", cls: "bg-amber-100 text-amber-900" },
  unregistered: { label: "Unregistered", cls: "bg-slate-100 text-slate-700" },
};
