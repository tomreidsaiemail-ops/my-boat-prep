import os, requests, json
B = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
H = {"Authorization": "Bearer test_session_pro_1"}
r = requests.post(f"{B}/api/sea-route", json={"a": {"lat": -41.0897, "lon": 174.8686}, "b": {"lat": -41.2906, "lon": 174.0057}}, headers=H, timeout=120).json()
print(r["a_water"], r["a_moved"], r["points"][:4], r["land"][:3])
line = [r["a_water"], *r["points"][:1]]
print("check first part", requests.post(f"{B}/api/sea-check", json={"line": line}, headers=H, timeout=60).json())
# halves
a, b = line
m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
print("halves", requests.post(f"{B}/api/sea-check", json={"line": [a, m, b]}, headers=H, timeout=60).json())
