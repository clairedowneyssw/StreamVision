from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="StreamVisionAR API")
api_router = APIRouter(prefix="/api")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


# ----------------------- Models -----------------------
class Layer(BaseModel):
    key: str
    label: str
    color: str
    enabled: bool = True


class Project(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    location: str
    code: str
    status: str = "active"          # active | on_hold | completed
    sync_state: str = "synced"      # synced | requires_sync | offline_cached
    progress: int = 0               # 0-100 percent built
    deviation_mm: float = 0.0       # planned vs built avg deviation
    image_url: str = ""
    layers: List[Layer] = []
    open_issues: int = 0
    created_at: str = Field(default_factory=now_iso)


class Issue(BaseModel):
    id: str = Field(default_factory=new_id)
    project_id: str
    ref: str                        # e.g. RFI-104
    title: str
    description: str = ""
    tag: str = "needs_review"       # wrong_install | needs_review | rfi | clash
    status: str = "open"            # open | in_review | resolved
    location_label: str = ""
    photo_b64: Optional[str] = None
    author: str = "Field User"
    created_at: str = Field(default_factory=now_iso)


class IssueCreate(BaseModel):
    project_id: str
    title: str
    description: str = ""
    tag: str = "needs_review"
    location_label: str = ""
    photo_b64: Optional[str] = None
    author: str = "Field User"


class IssueUpdate(BaseModel):
    status: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    tag: Optional[str] = None


class Activity(BaseModel):
    id: str = Field(default_factory=new_id)
    project_id: str
    kind: str = "comment"           # comment | pin | issue | sync
    author: str = "Field User"
    message: str
    anchor: str = ""                # physical-space anchor label
    created_at: str = Field(default_factory=now_iso)


class ActivityCreate(BaseModel):
    project_id: str
    kind: str = "comment"
    author: str = "Field User"
    message: str
    anchor: str = ""


# ----------------------- Seed -----------------------
DEFAULT_LAYERS = [
    {"key": "structural", "label": "STRUCTURAL", "color": "#FF5A00", "enabled": True},
    {"key": "mep", "label": "MEP", "color": "#0055FF", "enabled": True},
    {"key": "electrical", "label": "ELECTRICAL", "color": "#FFC800", "enabled": False},
    {"key": "plumbing", "label": "PLUMBING", "color": "#008A00", "enabled": False},
]

SEED_PROJECTS = [
    {
        "name": "RIVERSIDE TOWER B",
        "location": "Dock 7, Portland OR",
        "code": "RVT-B",
        "status": "active",
        "sync_state": "synced",
        "progress": 62,
        "deviation_mm": 14.2,
        "image_url": "https://images.pexels.com/photos/25461690/pexels-photo-25461690.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
        "open_issues": 3,
    },
    {
        "name": "NORTHGATE TRANSIT HUB",
        "location": "Lot 14, Seattle WA",
        "code": "NGH",
        "status": "active",
        "sync_state": "offline_cached",
        "progress": 38,
        "deviation_mm": 22.8,
        "image_url": "https://images.pexels.com/photos/1216544/pexels-photo-1216544.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
        "open_issues": 5,
    },
    {
        "name": "HARBOR LOGISTICS WAREHOUSE",
        "location": "Pier 3, Oakland CA",
        "code": "HLW",
        "status": "active",
        "sync_state": "requires_sync",
        "progress": 81,
        "deviation_mm": 6.5,
        "image_url": "https://images.pexels.com/photos/2219024/pexels-photo-2219024.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
        "open_issues": 1,
    },
]

SEED_ISSUES = [
    {"ref": "RFI-104", "title": "Column C4 offset from grid", "tag": "clash",
     "status": "open", "location_label": "Level 3 / Grid C4",
     "description": "AR overlay shows column 38mm east of planned grid line."},
    {"ref": "WI-088", "title": "Duct run conflicts with beam", "tag": "wrong_install",
     "status": "in_review", "location_label": "Level 2 / Mech Room",
     "description": "Installed MEP duct clashes with structural beam B12."},
    {"ref": "NR-051", "title": "Verify slab edge rebar spacing", "tag": "needs_review",
     "status": "resolved", "location_label": "Level 1 / East Edge",
     "description": "Field measure matched plan within tolerance."},
]

SEED_ACTIVITY = [
    {"kind": "pin", "author": "M. Alvarez", "message": "Pinned clash zone near C4 — needs PM review.", "anchor": "Grid C4"},
    {"kind": "comment", "author": "J. Park", "message": "Confirmed duct rerouted on site, updating model.", "anchor": "Mech Room"},
    {"kind": "sync", "author": "System", "message": "Model v4.2 cached for offline use (412 MB).", "anchor": ""},
]


async def seed_if_empty():
    if await db.projects.count_documents({}) > 0:
        return
    logger.info("Seeding StreamVisionAR sample data...")
    for p in SEED_PROJECTS:
        proj = Project(**p, layers=[Layer(**l) for l in DEFAULT_LAYERS])
        await db.projects.insert_one(proj.dict())
        for i, iss in enumerate(SEED_ISSUES):
            issue = Issue(project_id=proj.id, author="Field User", **iss)
            await db.issues.insert_one(issue.dict())
        for act in SEED_ACTIVITY:
            activity = Activity(project_id=proj.id, **act)
            await db.activity.insert_one(activity.dict())


# ----------------------- Routes -----------------------
@api_router.get("/")
async def root():
    return {"message": "StreamVisionAR API online"}


@api_router.get("/health")
async def health():
    return {"status": "ok", "time": now_iso()}


@api_router.get("/projects", response_model=List[Project])
async def list_projects():
    docs = await db.projects.find({}, {"_id": 0}).to_list(200)
    return [Project(**d) for d in docs]


@api_router.get("/projects/{project_id}", response_model=Project)
async def get_project(project_id: str):
    doc = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Project not found")
    return Project(**doc)


@api_router.get("/projects/{project_id}/issues", response_model=List[Issue])
async def project_issues(project_id: str):
    docs = await db.issues.find({"project_id": project_id}, {"_id": 0}).to_list(500)
    docs.sort(key=lambda d: d.get("created_at", ""), reverse=True)
    return [Issue(**d) for d in docs]


@api_router.get("/projects/{project_id}/activity", response_model=List[Activity])
async def project_activity(project_id: str):
    docs = await db.activity.find({"project_id": project_id}, {"_id": 0}).to_list(500)
    docs.sort(key=lambda d: d.get("created_at", ""), reverse=True)
    return [Activity(**d) for d in docs]


@api_router.post("/issues", response_model=Issue)
async def create_issue(payload: IssueCreate):
    proj = await db.projects.find_one({"id": payload.project_id}, {"_id": 0})
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    count = await db.issues.count_documents({"project_id": payload.project_id})
    ref = f"PL-{count + 1:03d}"
    issue = Issue(ref=ref, **payload.dict())
    await db.issues.insert_one(issue.dict())
    # bump open issue count
    open_count = await db.issues.count_documents({"project_id": payload.project_id, "status": {"$ne": "resolved"}})
    await db.projects.update_one({"id": payload.project_id}, {"$set": {"open_issues": open_count}})
    # activity entry
    act = Activity(project_id=payload.project_id, kind="issue", author=payload.author,
                   message=f"Logged {ref}: {payload.title}", anchor=payload.location_label)
    await db.activity.insert_one(act.dict())
    return issue


@api_router.patch("/issues/{issue_id}", response_model=Issue)
async def update_issue(issue_id: str, payload: IssueUpdate):
    update = {k: v for k, v in payload.dict().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")
    doc = await db.issues.find_one({"id": issue_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Issue not found")
    await db.issues.update_one({"id": issue_id}, {"$set": update})
    merged = {**doc, **update}
    open_count = await db.issues.count_documents({"project_id": doc["project_id"], "status": {"$ne": "resolved"}})
    await db.projects.update_one({"id": doc["project_id"]}, {"$set": {"open_issues": open_count}})
    return Issue(**merged)


@api_router.get("/issues/{issue_id}", response_model=Issue)
async def get_issue(issue_id: str):
    doc = await db.issues.find_one({"id": issue_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Issue not found")
    return Issue(**doc)


@api_router.post("/activity", response_model=Activity)
async def create_activity(payload: ActivityCreate):
    act = Activity(**payload.dict())
    await db.activity.insert_one(act.dict())
    return act


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def startup():
    await seed_if_empty()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
