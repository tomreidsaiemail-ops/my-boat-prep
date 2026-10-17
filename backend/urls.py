import os
import re
from fastapi import Request

PUBLIC_APP_URL = os.environ["PUBLIC_APP_URL"].rstrip("/")
HOST_RE = re.compile(r"^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$")


def request_host(request: Request) -> str:
    return (request.headers.get("x-forwarded-host") or request.headers.get("host") or "").split(",")[0].strip().lower()


def public_base(request: Request) -> str:
    host = request_host(request)
    return f"https://{host}" if HOST_RE.match(host) else PUBLIC_APP_URL
