import asyncio
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated, List, Literal

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import BaseModel, Field
from twilio.base.exceptions import TwilioRestException
from twilio.rest import Client

from auth import get_current_user
from db import db
from distress_email import distress_subject
from shore_alert import _aboard

log = logging.getLogger(__name__)
logging.getLogger("twilio.http_client").setLevel(logging.WARNING)  # its INFO lines carry the account id
router = APIRouter(prefix="/api")
DAILY_LIMIT = 30
MAX_BODY = 1500
FINAL = {"delivered", "undelivered", "failed"}
POLL = (5, 5, 10, 10, 15, 15, 20, 30, 30, 40)  # about 3 minutes of delivery checks
Line = Annotated[str, Field(max_length=600)]
Owner = Annotated[str, Query(pattern=r"^[A-Za-z0-9_-]{0,80}$")]
BoatQ = Annotated[str, Query(pattern=r"^[A-Za-z0-9_-]{1,40}$")]
SmsId = Annotated[str, Path(pattern=r"^[a-f0-9-]{36}$")]


class DistressSmsIn(BaseModel):
    owner_id: str = Field(default="", pattern=r"^[A-Za-z0-9_-]{0,80}$")
    boat_id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,40}$")
    kind: Literal["mayDay", "panPan"]
    vessel: str = Field(default="", max_length=80)
    callsign: str = Field(default="", max_length=40)
    position: str = Field(default="", max_length=120)
    lines: List[Line] = Field(default_factory=list, max_length=120)


def _twilio():
    sid, token, sender = (os.environ.get(k, "").strip() for k in ("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER"))
    return (Client(sid, token), sender) if sid and token and sender else (None, "")


async def _phones(doc: dict) -> list:
    """Every shore contact with a phone: those watching and those still invited."""
    joined = [c.get("phone") for c in (doc.get("shore") or {}).values()]
    invited = [i.get("phone") async for i in db.shore_invites.find({"owner_id": doc["owner_id"], "boat_id": doc["boat_id"], "phone": {"$nin": ["", None]}}, {"_id": 0, "phone": 1})]
    return list(dict.fromkeys(p for p in joined + invited if p))


async def _set(sms_id: str, to: str, **fields):
    await db.distress_sms.update_one({"sms_id": sms_id, "messages.to": to}, {"$set": {f"messages.$.{k}": v for k, v in fields.items()}})


async def _send_one(client, sender: str, sms_id: str, to: str, body: str):
    for wait in (0, 5, 20):
        await asyncio.sleep(wait)
        try:
            m = await asyncio.to_thread(client.messages.create, to=to, from_=sender, body=body)
            await _set(sms_id, to, sid=m.sid, status=m.status)
            return
        except TwilioRestException as e:
            log.warning("Distress SMS to ...%s refused: %s", to[-4:], e.msg)
            if e.status and 400 <= e.status < 500:
                break
        except Exception as e:  # noqa: BLE001
            log.warning("Distress SMS to ...%s failed (retrying): %s", to[-4:], e)
    await _set(sms_id, to, status="failed")


async def _send_all(sms_id: str, phones: list, body: str):
    """Background only: a slow or failed SMS never holds up the VHF call. Then checks delivery for the tick."""
    client, sender = _twilio()
    await asyncio.gather(*(_send_one(client, sender, sms_id, to, body) for to in phones))
    for wait in POLL:
        await asyncio.sleep(wait)
        doc = await db.distress_sms.find_one({"sms_id": sms_id}, {"_id": 0, "messages": 1}) or {}
        pending = [m for m in doc.get("messages", []) if m.get("sid") and m.get("status") not in FINAL]
        if not pending:
            return
        for m in pending:
            try:
                msg = await asyncio.to_thread(lambda sid=m["sid"]: client.messages(sid).fetch())
                await _set(sms_id, m["to"], status=msg.status)
            except Exception as e:  # noqa: BLE001
                log.warning("Distress SMS status check failed: %s", e)


_tasks: set = set()


@router.get("/distress-sms/phones")
async def sms_phones(boat_id: BoatQ, owner_id: Owner = "", user: dict = Depends(get_current_user)):
    doc = await _aboard(user, owner_id, boat_id)
    return {"phones": len(await _phones(doc)) if _twilio()[0] else 0}


@router.post("/distress-sms")
async def send_distress_sms(p: DistressSmsIn, user: dict = Depends(get_current_user)):
    doc = await _aboard(user, p.owner_id, p.boat_id)
    phones = await _phones(doc)
    if not phones or not _twilio()[0]:
        return {"sms_id": None, "count": 0}
    since = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    if await db.distress_sms.count_documents({"user_id": user["user_id"], "created_at": {"$gte": since}}) >= DAILY_LIMIT:
        raise HTTPException(status_code=429, detail="Daily distress SMS limit reached")
    body = "\n".join([distress_subject(p), *(t.strip() for t in p.lines if t.strip())])[:MAX_BODY]
    sms_id = str(uuid.uuid4())
    await db.distress_sms.insert_one({"sms_id": sms_id, "user_id": user["user_id"], "owner_id": doc["owner_id"], "boat_id": p.boat_id, "kind": p.kind,
                                      "messages": [{"to": to, "status": "sending"} for to in phones], "created_at": datetime.now(timezone.utc).isoformat()})
    t = asyncio.create_task(_send_all(sms_id, phones, body))
    _tasks.add(t)
    t.add_done_callback(_tasks.discard)
    return {"sms_id": sms_id, "count": len(phones)}


@router.get("/distress-sms/{sms_id}")
async def sms_status(sms_id: SmsId, user: dict = Depends(get_current_user)):
    doc = await db.distress_sms.find_one({"sms_id": sms_id, "user_id": user["user_id"]}, {"_id": 0, "messages": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    msgs = doc["messages"]
    delivered = sum(m.get("status") == "delivered" for m in msgs)
    done = all(m.get("status") in FINAL for m in msgs)
    return {"status": "delivered" if delivered and done else "failed" if done else "sending", "delivered": delivered, "total": len(msgs)}
