# Electrical Service: Magic Marine Engineer endpoint validation (no AI calls) - iteration 149
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PRO = {"Authorization": "Bearer test_session_pro_1"}


class TestElectricalAsk:
    def test_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/ai/electrical-ask", json={"question": "x"})
        assert r.status_code == 401

    def test_voltage_too_long_rejected(self):
        r = requests.post(f"{BASE_URL}/api/ai/electrical-ask", headers=PRO, json={"question": "flat battery", "voltage": "123456789"})
        assert r.status_code == 422

    def test_too_many_equipment_rejected(self):
        r = requests.post(f"{BASE_URL}/api/ai/electrical-ask", headers=PRO, json={"question": "flat battery", "equipment": [str(i) for i in range(11)]})
        assert r.status_code == 422

    def test_too_many_batteries_rejected(self):
        r = requests.post(f"{BASE_URL}/api/ai/electrical-ask", headers=PRO, json={"question": "flat battery", "batteries": [str(i) for i in range(11)]})
        assert r.status_code == 422

    def test_empty_question_rejected(self):
        r = requests.post(f"{BASE_URL}/api/ai/electrical-ask", headers=PRO, json={"question": ""})
        assert r.status_code == 422

    def test_engine_ask_still_validates(self):
        r = requests.post(f"{BASE_URL}/api/ai/engine-ask", headers=PRO, json={"question": ""})
        assert r.status_code == 422
