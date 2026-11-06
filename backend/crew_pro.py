from typing import Optional
from fastapi import HTTPException
from db import db
from auth import to_user_out


async def magic_payer(user: dict, boat_id: Optional[str], owner: Optional[str]) -> dict:
    """Who pays for a Magic: the user on their own boat, or the Pro skipper when crew use the provisioning tools on the skipper's boat."""
    if not owner or owner == user["user_id"]:
        if not to_user_out(user).premium:
            raise HTTPException(status_code=403, detail="Upgrade to Pro to use this feature")
        return user
    if not boat_id or not await db.user_boats.find_one({"owner_id": owner, "boat_id": boat_id, "crew": user["user_id"]}, {"_id": 1}):
        raise HTTPException(status_code=404, detail="Boat not found")
    skipper = await db.users.find_one({"user_id": owner}, {"_id": 0})
    if not skipper or not to_user_out(skipper).premium:
        raise HTTPException(status_code=403, detail="This needs the skipper to have Pro")
    return skipper
