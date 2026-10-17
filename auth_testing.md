# Auth Testing Playbook (Emergent Google Auth)

Step 1: Create Test User & Session
mongosh --eval "
use('test_database');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({user_id: userId, email: 'test.user.' + Date.now() + '@example.com', name: 'Test User', picture: '', role: 'free', created_at: new Date().toISOString()});
db.user_sessions.insertOne({user_id: userId, session_token: sessionToken, expires_at: new Date(Date.now() + 7*24*60*60*1000), created_at: new Date()});
print('Session token: ' + sessionToken);
"

Step 2: Backend
curl -X GET "$API/api/auth/me" -H "Authorization: Bearer YOUR_SESSION_TOKEN"

Step 3: Browser
await page.context.add_cookies([{"name": "session_token", "value": "YOUR_SESSION_TOKEN", "domain": "gemini-prototype.preview.emergentagent.com", "path": "/", "httpOnly": True, "secure": True, "sameSite": "None"}])
await page.goto(URL)

Checklist: user doc has user_id; session user_id matches; queries use {"_id": 0}; /api/auth/me returns user.
Admin = user whose email equals ADMIN_EMAIL (tomreidsaiemail@gmail.com).
Clean: db.users.deleteMany({email: /test\.user\./}); db.user_sessions.deleteMany({session_token: /test_session/});


## Email/password auth
- Users: db.users has password_hash (bcrypt $2b$) for password accounts, email_verified false until reset-by-email or Google sign-in.
- curl -c c.txt -X POST $API/api/auth/login -H "Content-Type: application/json" -d '{"email":"test.user.password@example.com","password":"Harbour2026!"}' ; curl -b c.txt $API/api/auth/me
- Reset: POST /api/auth/forgot-password {email} always returns {ok:true}; token stored hashed (sha256) in db.password_reset_tokens (1h, single use). To test reset without email, insert a token doc: {token_hash: sha256(raw), user_id, used:false, created_at: now, expires_at: now+1h} then POST /api/auth/reset-password {token: raw, password}.
- Cross-site writes with an Origin header from another host get 403.
