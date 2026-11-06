// Who is buying each Provisions item: saved on the item as "shopper".
const low = (s) => String(s || "").trim().toLowerCase();
export const itemText = (i) => String(i.label || "").replace(/^\s*\d+[.)]\s*/, "").trim();

export const shoppingFor = (items, name) => (low(name) ? (items || []).filter((i) => !i.checked && low(i.shopper) === low(name)).map(itemText) : []);

export const shopperGroups = (items) => {
  const by = new Map();
  (items || []).filter((i) => String(i.shopper || "").trim()).forEach((i) => {
    const k = low(i.shopper);
    if (!by.has(k)) by.set(k, { name: i.shopper.trim(), items: [] });
    by.get(k).items.push(i);
  });
  return [...by.values()];
};

export const shoppingMessage = ({ vessel, skipper, name, items }) => [
  `*${name ? `Hi ${name}, here's` : "Here's"} your shopping for ${vessel}*`,
  `${skipper} has asked you to buy these and bring them on board:`,
  ...items.map((i) => `- ${i}`),
].join("\n");
