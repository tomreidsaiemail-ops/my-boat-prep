import sys
sys.path.insert(0, "/app/backend")
from layout_rules import check, rules_prompt  # noqa: E402

PARSED = {"cabins": 3, "heads": 2, "rules": [
    {"area": "cabin", "side": "port", "position": "aft", "aft_of": "", "forward_of": ""},
    {"area": "cabin", "side": "starboard", "position": "aft", "aft_of": "", "forward_of": ""},
    {"area": "cabin", "side": "centre", "position": "forward", "aft_of": "", "forward_of": ""},
    {"area": "heads", "side": "centre", "position": "forward", "aft_of": "", "forward_of": ""},
    {"area": "heads", "side": "port", "position": "aft", "aft_of": "", "forward_of": ""},
    {"area": "galley", "side": "port", "position": "midships", "aft_of": "", "forward_of": ""},
    {"area": "nav station", "side": "starboard", "position": "", "aft_of": "saloon", "forward_of": ""},
]}
GOOD = {"bow": "up", "areas": [
    {"label": "Heads", "x": 0.5, "y": 0.08}, {"label": "Forward cabin", "x": 0.5, "y": 0.2}, {"label": "Galley", "x": 0.3, "y": 0.5},
    {"label": "Saloon", "x": 0.55, "y": 0.45}, {"label": "Nav station", "x": 0.7, "y": 0.6}, {"label": "Heads", "x": 0.3, "y": 0.65},
    {"label": "Aft port cabin", "x": 0.3, "y": 0.85}, {"label": "Aft starboard cabin", "x": 0.7, "y": 0.85}]}


def test_good_plan_passes():
    assert check(PARSED, GOOD) == []


def test_galley_on_starboard_is_caught():
    bad = {**GOOD, "areas": [a if a["label"] != "Galley" else {**a, "x": 0.75} for a in GOOD["areas"]]}
    assert any("Galley" in p for p in check(PARSED, bad))


def test_bow_right_and_wrong_counts_are_caught():
    probs = check(PARSED, {"bow": "right", "areas": GOOD["areas"][:-1]})
    assert any("bow points right" in p for p in probs) and any("2 cabins" in p for p in probs)


def test_nav_forward_of_saloon_is_caught():
    bad = {**GOOD, "areas": [a if a["label"] != "Nav station" else {**a, "y": 0.3} for a in GOOD["areas"]]}
    assert any("Nav Station" in p for p in check(PARSED, bad))


def test_prompt_states_exact_counts_and_sides():
    text = rules_prompt(PARSED)
    assert "exactly 3 cabins" in text and "exactly 2 heads" in text and "LEFT half of the picture (port)" in text
    assert rules_prompt({"cabins": 0, "heads": 0, "rules": []}) == ""


def test_spread_moves_overlapping_labels_apart_but_keeps_them_near():
    from zone_schematics import spread, DECK_RE
    out = spread([{"label": "Galley", "x": 0.4, "y": 0.5}, {"label": "Saloon", "x": 0.45, "y": 0.5}], 0.67)
    a, b = out
    assert abs(a["y"] - b["y"]) >= 24 / 288 - 1e-6 or abs(a["x"] - b["x"]) > 0.2
    assert all(abs(p["x"] - h) <= 0.15 + 1e-9 for p, h in zip(out, (0.4, 0.45)))
    assert DECK_RE.search("Port Fore Deck") and DECK_RE.search("Anchor locker") and not DECK_RE.search("Cockpit") and not DECK_RE.search("Transom")
