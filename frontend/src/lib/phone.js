// Phone numbers must start with + and a country code, so they work from anywhere (e.g. +64 21 555 1234).
const PHONE = /^\+[1-9]\d{0,3}[ -]?\(?\d[\d ()-]{4,}$/;
export const PHONE_HINT = "Start with + and the country code, e.g. +64 21 555 1234";
export const phoneError = (v) => (v && v.trim() && !PHONE.test(v.trim()) ? PHONE_HINT : "");
export const phoneFieldErrors = (values, keys = ["phone", "nok_phone"]) => keys.filter((k) => phoneError(values[k]));
