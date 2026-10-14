from fastapi import FastAPI, APIRouter, HTTPException, Path as PathParam
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, BeforeValidator
from typing import Annotated, Optional, List, Dict, Any
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

PyObjectId = Annotated[str, BeforeValidator(lambda v: str(v) if isinstance(v, ObjectId) else v)]


class BaseDocument(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    id: Optional[PyObjectId] = Field(default=None, alias="_id")

    @classmethod
    def from_mongo(cls, doc: dict):
        return cls.model_validate(doc)

    def to_mongo(self) -> dict:
        data = self.model_dump(by_alias=True, exclude={"id"})
        return data


class BoatDetails(BaseModel):
    vessel: str = ""
    skipper: str = ""
    callsign: str = ""


class BoatStateIn(BaseModel):
    boat: BoatDetails
    registry: List[Dict[str, Any]]
    data: Dict[str, List[Dict[str, Any]]]
    updated_at: str


class BoatState(BaseDocument):
    device_id: str
    boat: BoatDetails
    registry: List[Dict[str, Any]]
    data: Dict[str, List[Dict[str, Any]]]
    updated_at: str
    synced_at: str


class BoatStateOut(BaseModel):
    device_id: str
    boat: BoatDetails
    registry: List[Dict[str, Any]]
    data: Dict[str, List[Dict[str, Any]]]
    updated_at: str
    synced_at: str


DeviceId = Annotated[str, PathParam(min_length=8, max_length=64, pattern=r"^[A-Za-z0-9\-]+$")]


def to_out(state: BoatState) -> BoatStateOut:
    return BoatStateOut(**state.model_dump(exclude={"id"}))


@api_router.get("/")
async def root():
    return {"message": "My Boat Prep API"}


@api_router.get("/boats/{device_id}", response_model=BoatStateOut)
async def get_boat(device_id: DeviceId):
    doc = await db.boats.find_one({"device_id": device_id})
    if not doc:
        raise HTTPException(status_code=404, detail="No saved boat for this device")
    return to_out(BoatState.from_mongo(doc))


@api_router.put("/boats/{device_id}", response_model=BoatStateOut)
async def save_boat(payload: BoatStateIn, device_id: DeviceId):
    state = BoatState(
        device_id=device_id,
        boat=payload.boat,
        registry=payload.registry,
        data=payload.data,
        updated_at=payload.updated_at,
        synced_at=datetime.now(timezone.utc).isoformat(),
    )
    await db.boats.update_one({"device_id": device_id}, {"$set": state.to_mongo()}, upsert=True)
    return to_out(state)


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')


@app.on_event("startup")
async def create_indexes():
    await db.boats.create_index("device_id", unique=True)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
