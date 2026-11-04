from copy import deepcopy

SECTIONS = ("boat", "registry", "engine_log", "electrical_log", "rigging_log", "deleted_lists", "emergency_checked", "template_versions", "log_sent", "areas", "list_hidden")


def _ts(item: dict, fallback: str) -> str:
    return item.get("ts") or fallback


def _id(item: dict):
    v = item.get("id")
    return v if isinstance(v, (str, int, float, type(None))) else repr(v)


def _merge_list(a_items: list, a_s: str, b_items: list, b_s: str) -> list:
    # `a` has the newer (or equal) list-structure stamp, so its order and deletions win.
    b_by = {_id(i): i for i in b_items}
    out, a_ids = [], set()
    for it in a_items:
        a_ids.add(_id(it))
        other = b_by.get(_id(it))
        out.append(other if other and _ts(other, b_s) > _ts(it, a_s) else it)
    out += [i for i in b_items if _id(i) not in a_ids and _ts(i, b_s) > a_s]
    return out


def merge_state(prev: dict, inc: dict) -> dict:
    """Merge two copies of a boat: sections by last change, list items one by one."""
    ps, is_ = prev.get("sec_ts") or {}, inc.get("sec_ts") or {}
    out = {k: deepcopy(inc.get(k) if is_.get(k, "") >= ps.get(k, "") else prev.get(k)) for k in SECTIONS}
    pl, il = prev.get("list_ts") or {}, inc.get("list_ts") or {}
    pdata, idata = prev.get("data") or {}, inc.get("data") or {}
    data = {}
    for lid in set(pdata) | set(idata):
        if lid not in pdata or lid not in idata:
            data[lid] = deepcopy(idata.get(lid, pdata.get(lid)))
            continue
        p_s, i_s = pl.get(lid, ""), il.get(lid, "")
        data[lid] = _merge_list(idata[lid], i_s, pdata[lid], p_s) if i_s >= p_s else _merge_list(pdata[lid], p_s, idata[lid], i_s)
    ids = {r.get("id") for r in out["registry"] or []}
    out["data"] = {k: v for k, v in data.items() if k in ids}
    out["sec_ts"] = {k: max(ps.get(k, ""), is_.get(k, "")) for k in set(ps) | set(is_)}
    out["list_ts"] = {k: max(pl.get(k, ""), il.get(k, "")) for k in set(pl) | set(il)}
    out["updated_at"] = max(prev.get("updated_at", ""), inc.get("updated_at", ""))
    return out


def keep_pushed(merged: dict, inc: dict, pending: list) -> tuple:
    """Entries the server added to a list (e.g. crew Ship's Log entries) stay until the skipper's phone has sent them back once;
    only after that can it delete them. Returns the merged copy and the ids its phone now has."""
    have = []
    for p in pending or []:
        lid, item = p.get("list"), p.get("item") or {}
        if any(i.get("id") == item.get("id") for i in (inc.get("data") or {}).get(lid) or []):
            have.append(item.get("id"))
            continue
        lst = (merged.get("data") or {}).get(lid)
        if lst is not None and not any(i.get("id") == item.get("id") for i in lst):
            lst.append(deepcopy(item))
    return merged, have


def merge_crew_ticks(prev: dict, inc: dict) -> dict:
    """Crew may only tick and untick existing items; everything else stays as the owner left it."""
    out = deepcopy(prev)
    pl, il = prev.get("list_ts") or {}, inc.get("list_ts") or {}
    for lid, items in (out.get("data") or {}).items():
        theirs = {i.get("id"): i for i in (inc.get("data") or {}).get(lid, [])}
        for n, it in enumerate(items):
            t = theirs.get(it.get("id"))
            if t and bool(t.get("checked")) != bool(it.get("checked")) and _ts(t, il.get(lid, "")) > _ts(it, pl.get(lid, "")):
                items[n] = {**it, "checked": bool(t.get("checked")), "ts": t.get("ts") or il.get(lid, "")}
    out["updated_at"] = max(prev.get("updated_at", ""), inc.get("updated_at", ""))
    return out
