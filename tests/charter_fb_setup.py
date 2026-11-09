import os, sys, json, requests
from datetime import date
BASE = open('/app/frontend/.env').read().split('REACT_APP_BACKEND_URL=')[1].split('\n')[0].strip().rstrip('/') + '/api'
pro = requests.Session(); pro.cookies.set('session_token', 'test_session_pro_1')
beta = requests.Session(); beta.cookies.set('session_token', 'test_session_beta_1')
step = sys.argv[1]
if step == 'create':
    today = date.today().isoformat()
    r = pro.post(f'{BASE}/charters', json={'boat_id': 'main', 'name': 'TEST_Beta Skipper', 'email': 'test.user.beta@example.com', 'start': today, 'end': today})
    print(r.status_code, r.text[:300]); cid = r.json()['charter_id']
    r = pro.post(f'{BASE}/charters/{cid}/handover'); print('handover', r.status_code, r.text[:200])
    copy = r.json().get('copy_boat_id') or f'ch{cid[:12]}'
    t = beta.get(f'{BASE}/charter-terms', params={'boat_id': copy}).json()
    ticked = [i['id'] for i in t['responsibilities']] + [s['id'] for s in t['stops']]
    r = beta.post(f'{BASE}/charter-terms', params={'boat_id': copy}, json={'ticked': ticked}); print('terms', r.status_code, r.text[:200])
    b = beta.get(f'{BASE}/me/boat', params={'boat_id': copy}).json()
    st = b.get('state') if 'state' in b else b
    print('keys', list(b.keys())[:20])
    open('/tmp/charter_ids.json', 'w').write(json.dumps({'cid': cid, 'copy': copy}))
elif step == 'return':
    ids = json.load(open('/tmp/charter_ids.json'))
    r = pro.post(f"{BASE}/charters/{ids['cid']}/return"); print(r.status_code, r.text[:300])
