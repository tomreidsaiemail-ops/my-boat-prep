from typing import Optional
from fastapi import HTTPException
from db import db
from auth import to_user_out
from sync_merge import galley_crew


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



async def galley_payer(user: dict, boat_id: Optional[str], owner: Optional[str]) -> dict:
    """Like magic_payer, but crew must hold a Provision Manager or Galley Lead / Chef role."""
    payer = await magic_payer(user, boat_id, owner)
    if payer["user_id"] != user["user_id"]:
        doc = await db.user_boats.find_one({"owner_id": payer["user_id"], "boat_id": boat_id}, {"_id": 0, f"crew_roles.{user['user_id']}": 1})
        if not galley_crew(((doc or {}).get("crew_roles") or {}).get(user["user_id"])):
            raise HTTPException(status_code=403, detail="Only crew with a Provision Manager or Galley Lead / Chef role can do this")
    return payer
