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
