import json, requests, time
from datetime import datetime, timezone
BASE = open('/app/frontend/.env').read().split('REACT_APP_BACKEND_URL=')[1].split('\n')[0].strip().rstrip('/') + '/api'
beta = requests.Session(); beta.cookies.set('session_token', 'test_session_beta_1')
ids = json.load(open('/tmp/charter_ids.json'))
b = beta.get(f'{BASE}/me/boat', params={'boat_id': ids['copy']}).json()
now = datetime.now(timezone.utc).isoformat()
b['data'].setdefault('shipsLog', []).append({'id': int(time.time() * 1000), 'label': 'TEST_Motored out of the marina, all good', 'checked': False, 'ts': now})
b['data'].setdefault('myTodo', []).append({'id': int(time.time() * 1000) + 1, 'label': 'TEST_Refill water tank', 'checked': False, 'ts': now})
b['list_ts'] = {**(b.get('list_ts') or {}), 'shipsLog': now, 'myTodo': now}
for k in ('owner_id', 'boat_id', 'role', 'synced_at'):
    b.pop(k, None)
r = beta.put(f'{BASE}/me/boat', params={'boat_id': ids['copy']}, json=b)
print(r.status_code, [i['label'] for i in r.json()['data'].get('shipsLog', [])], [i['label'] for i in r.json()['data'].get('myTodo', [])])
