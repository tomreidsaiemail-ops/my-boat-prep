import sys
sys.path.insert(0, "/app/backend")


def test_spread_moves_overlapping_labels_apart_but_keeps_them_near():
    from zone_schematics import spread, DECK_RE
    out = spread([{"label": "Galley", "x": 0.4, "y": 0.5}, {"label": "Saloon", "x": 0.45, "y": 0.5}], 0.67)
    a, b = out
    assert abs(a["y"] - b["y"]) >= 24 / 288 - 1e-6 or abs(a["x"] - b["x"]) > 0.2
    assert all(abs(p["x"] - h) <= 0.15 + 1e-9 for p, h in zip(out, (0.4, 0.45)))
    assert DECK_RE.search("Port Fore Deck") and DECK_RE.search("Anchor locker") and not DECK_RE.search("Cockpit") and not DECK_RE.search("Transom")
