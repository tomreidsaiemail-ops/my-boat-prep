// The boat's "Crew Roles" list: headings group the roles, and the ticked roles are the ones offered when inviting crew.
export const CREW_ROLES = /^crew roles$/i;
export const INVITE_DRAFT = "mbp_invite_draft";
const clean = (s) => String(s || "").replace(/^\s*\*\s*/, "").replace(/^\d+[.)]\s*/, "").replace(/\s+/g, " ").trim().slice(0, 40);

export const crewRolesList = (state) => state?.registry?.find((l) => CREW_ROLES.test(String(l.name).trim()));

// Role name (lower case) -> the skipper's Role Briefing on the boat's Crew Roles list.
export const roleBriefings = (state) => {
  const list = crewRolesList(state);
  return Object.fromEntries(((list && state.data?.[list.id]) || []).filter((i) => String(i.briefing || "").trim()).map((i) => [clean(i.label).toLowerCase(), String(i.briefing).trim()]));
};

// [{ name: "Racing Roles", roles: ["Helm", ...] }]; with nothing ticked every role is offered, as before.
export const roleGroups = (state) => {
  const list = crewRolesList(state);
  const items = (list && state.data?.[list.id]) || [];
  const isHead = (k) => !items[k].indent && !!items[k + 1]?.indent;
  const anyTicked = items.some((it, k) => !isHead(k) && it.checked);
  const groups = [{ name: "", roles: [] }];
  items.forEach((it, k) => {
    if (isHead(k)) { groups.push({ name: clean(it.label), roles: [] }); return; }
    if (!it.indent && groups[groups.length - 1].name) groups.push({ name: "", roles: [] });
    const role = clean(it.label);
    if (role && (!anyTicked || it.checked)) groups[groups.length - 1].roles.push(role);
  });
  return groups.filter((g) => g.roles.length);
};
