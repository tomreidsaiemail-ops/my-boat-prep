# Admin Analytics dashboard, compute pricing, per-user compute and AI usage tracking (iteration 46)
import io
import os
import time
import pytest
import requests
from PIL import Image, ImageDraw

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN, PRO, FREE, BETA = "test_session_admin_1", "test_session_pro_1", "test_session_free_1", "test_session_beta_1"
CODES = ["MMD", "MPA", "MME", "MLG", "BMMS", "MMS"]


def h(tok):
    return {"Authorization": f"Bearer {tok}"}


def get_analytics():
    r = requests.get(f"{BASE_URL}/api/admin/analytics", headers=h(ADMIN), timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


def feat(a, code):
    return next(f for f in a["features"] if f["code"] == code)


@pytest.fixture(scope="module", autouse=True)
def restore_pricing():
    yield
    requests.put(f"{BASE_URL}/api/admin/compute-pricing", headers=h(ADMIN), json={"input_per_m": 0.5, "output_per_m": 3, "currency": "USD"}, timeout=30)


# --- Access control
class TestAccess:
    @pytest.mark.parametrize("path", ["/api/admin/analytics", "/api/admin/users/compute", "/api/admin/compute-pricing"])
    def test_no_auth_401(self, path):
        assert requests.get(f"{BASE_URL}{path}", timeout=30).status_code == 401

    @pytest.mark.parametrize("tok", [PRO, FREE, BETA])
    @pytest.mark.parametrize("path", ["/api/admin/analytics", "/api/admin/users/compute", "/api/admin/compute-pricing"])
    def test_non_admin_403(self, tok, path):
        assert requests.get(f"{BASE_URL}{path}", headers=h(tok), timeout=30).status_code == 403

    def test_put_pricing_non_admin_403(self):
        r = requests.put(f"{BASE_URL}/api/admin/compute-pricing", headers=h(PRO), json={"input_per_m": 1, "output_per_m": 1, "currency": "USD"}, timeout=30)
        assert r.status_code == 403


# --- Analytics shape
class TestAnalyticsShape:
    def test_shape(self):
        a = get_analytics()
        g = a["growth"]
        for k in ("users", "users_month", "pro", "pro_month"):
            assert isinstance(g[k], int)
        assert g["users"] >= g["users_month"] and g["pro"] >= g["pro_month"]
        c = a["compute"]
        for k in ("all", "month"):
            for f in ("tokens", "input", "output", "cost", "uses"):
                assert f in c[k]
        assert c["all"]["uses"] >= c["month"]["uses"]
        assert isinstance(c["ai_users"], int)
        assert set(c["avg_per_user"]) >= {"tokens", "cost"}
        assert [f["code"] for f in a["features"]] == CODES
        for f in a["features"]:
            assert set(f) >= {"code", "name", "users", "users_month", "uses", "uses_month", "tokens", "cost"}
        assert a["month_start"][8:19] == "01T00:00:00"
        assert set(a["pricing"]) >= {"input_per_m", "output_per_m", "currency"}

    def test_users_counts_match_admin_list(self):
        a = get_analytics()
        users = requests.get(f"{BASE_URL}/api/admin/users", headers=h(ADMIN), timeout=30).json()
        assert a["growth"]["users"] == len(users)
        assert a["growth"]["pro"] == len([u for u in users if u["role"] == "pro"])

    def test_feature_sum_equals_total(self):
        a = get_analytics()
        assert sum(f["uses"] for f in a["features"]) == a["compute"]["all"]["uses"]
        assert sum(f["tokens"] for f in a["features"]) == a["compute"]["all"]["tokens"]


# --- Pricing
class TestPricing:
    def test_validation(self):
        bad = [{"input_per_m": -1, "output_per_m": 1, "currency": "USD"}, {"input_per_m": 1, "output_per_m": 1001, "currency": "USD"},
               {"input_per_m": 1, "output_per_m": 1, "currency": "US"}, {"input_per_m": 1, "output_per_m": 1, "currency": "USDX"}]
        for b in bad:
            r = requests.put(f"{BASE_URL}/api/admin/compute-pricing", headers=h(ADMIN), json=b, timeout=30)
            assert r.status_code == 422, (b, r.status_code)

    def test_set_and_cost_recompute(self):
        r = requests.put(f"{BASE_URL}/api/admin/compute-pricing", headers=h(ADMIN), json={"input_per_m": 10, "output_per_m": 20, "currency": "nzd"}, timeout=30)
        assert r.status_code == 200 and r.json()["currency"] == "NZD"
        g = requests.get(f"{BASE_URL}/api/admin/compute-pricing", headers=h(ADMIN), timeout=30).json()
        assert g["input_per_m"] == 10 and g["output_per_m"] == 20 and g["currency"] == "NZD"
        a = get_analytics()
        c = a["compute"]["all"]
        assert abs(c["cost"] - round(c["input"] / 1e6 * 10 + c["output"] / 1e6 * 20, 4)) < 1e-6
        uc = requests.get(f"{BASE_URL}/api/admin/users/compute", headers=h(ADMIN), timeout=30).json()
        assert uc["pricing"]["currency"] == "NZD"
        r = requests.put(f"{BASE_URL}/api/admin/compute-pricing", headers=h(ADMIN), json={"input_per_m": 0.5, "output_per_m": 3, "currency": "USD"}, timeout=30)
        assert r.json() == {"input_per_m": 0.5, "output_per_m": 3.0, "currency": "USD"}


# --- Per-user compute
class TestUsersCompute:
    def test_shape_and_totals(self):
        uc = requests.get(f"{BASE_URL}/api/admin/users/compute", headers=h(ADMIN), timeout=30).json()
        assert "test-user-pro" in uc["users"]
        for uid, v in uc["users"].items():
            assert set(v) >= {"tokens", "uses", "cost", "tokens_month", "uses_month", "cost_month"}
            assert v["uses"] >= v["uses_month"]
        a = get_analytics()
        assert sum(v["uses"] for v in uc["users"].values()) == a["compute"]["all"]["uses"]
        assert len(uc["users"]) == a["compute"]["ai_users"]


# --- pro_since on admin role change
class TestProSince:
    def test_pro_month_increments(self):
        before = get_analytics()["growth"]
        r = requests.patch(f"{BASE_URL}/api/admin/users/test-user-free", headers=h(ADMIN), json={"role": "pro"}, timeout=30)
        try:
            assert r.status_code == 200, r.text
            after = get_analytics()["growth"]
            assert after["pro"] == before["pro"] + 1
            assert after["pro_month"] == before["pro_month"] + 1
        finally:
            requests.patch(f"{BASE_URL}/api/admin/users/test-user-free", headers=h(ADMIN), json={"role": "free"}, timeout=30)
        assert get_analytics()["growth"]["pro"] == before["pro"]


def jpeg():
    img = Image.new("RGB", (320, 240), "white")
    d = ImageDraw.Draw(img)
    d.rectangle([40, 60, 120, 200], fill="red")
    d.ellipse([160, 80, 260, 180], fill="blue")
    b = io.BytesIO()
    img.save(b, "JPEG")
    return b.getvalue()


# --- Real AI calls record usage per feature (one call each)
class TestUsageRecording:
    @pytest.mark.parametrize("code,path,body", [
        ("MMD", "/api/ai/doctor-ask", {"question": "Small cut on finger, what do I do?", "kit": ["Plasters", "Antiseptic wipes"]}),
        ("MME", "/api/ai/engine-ask", {"question": "Engine overheats at high revs", "engine_type": "Yanmar 3GM"}),
        ("MLG", "/api/ai/list-draft", {"name": "TEST_ Day sail", "description": "Short checklist for a day sail, 5 items"}),
        ("MPA", "/api/ai/mpa/aisles", {"items": ["Milk", "Bread"], "aisles": ["Dairy", "Bakery"]}),
    ])
    def test_ai_call_records_tokens(self, code, path, body):
        before = feat(get_analytics(), code)
        r = requests.post(f"{BASE_URL}{path}", headers=h(PRO), json=body, timeout=120)
        assert r.status_code == 200, r.text
        time.sleep(1)
        after = feat(get_analytics(), code)
        assert after["uses"] == before["uses"] + 1
        assert after["uses_month"] == before["uses_month"] + 1
        assert after["tokens"] > before["tokens"]

    @pytest.mark.parametrize("batch,code", [(False, "MMS"), (True, "BMMS")])
    def test_scan_records(self, batch, code):
        before = get_analytics()
        url = f"{BASE_URL}/api/boats/main/scan" + ("?batch=true" if batch else "")
        r = requests.post(url, headers=h(PRO), files={"file": ("t.jpg", jpeg(), "image/jpeg")}, timeout=120)
        assert r.status_code == 200, r.text
        assert "items" in r.json()
        time.sleep(1)
        after = get_analytics()
        assert feat(after, code)["uses"] == feat(before, code)["uses"] + 1
        assert feat(after, code)["tokens"] > feat(before, code)["tokens"]
        other = "BMMS" if code == "MMS" else "MMS"
        assert feat(after, other)["uses"] == feat(before, other)["uses"]
        assert after["compute"]["month"]["uses"] == before["compute"]["month"]["uses"] + 1
