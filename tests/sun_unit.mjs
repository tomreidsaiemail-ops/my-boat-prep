import { sunsetAt } from "../frontend/src/lib/sun.js";
const fmt = (d) => d.toISOString();
console.log("Auckland 2026-11-01", fmt(sunsetAt(-36.85, 174.76, new Date(2026, 10, 1, 12))));
console.log("London 2026-06-21", fmt(sunsetAt(51.5, -0.12, new Date(2026, 5, 21, 12))));
console.log("SF 2026-06-21", fmt(sunsetAt(37.77, -122.42, new Date(2026, 5, 21, 12))));
