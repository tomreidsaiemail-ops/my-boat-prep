import os
from pathlib import Path

from dotenv import dotenv_values

# Tests hit the public preview URL; take it from the frontend .env when the shell doesn't set it.
for env in (Path(__file__).resolve().parents[2] / "frontend" / ".env", Path(__file__).resolve().parents[1] / ".env"):
    for k, v in dotenv_values(env).items():
        if v and not os.environ.get(k):
            os.environ[k] = v
