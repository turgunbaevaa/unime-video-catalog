from fastapi import FastAPI
from contextlib import asynccontextmanager
from app.database import client, ensure_indexes
from app.routers import videos
from app.routers import export
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv
from app.routers import folders
from app.routers import search
from app.routers import import_backup

# Lifespan
@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await client.admin.command('ping')
        print("Successfully connected to MongoDB! 🎉")
        await ensure_indexes()
        print("MongoDB indexes ensured.")
    except Exception as e:
        print(f"Error connecting to MongoDB: {e}")
    yield

    client.close()
    print("MongoDB connection closed.")

app = FastAPI(
    title="UniMe Video Catalog API",
    lifespan=lifespan
)

load_dotenv()

raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
allowed_origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(videos.router)
app.include_router(export.router)
app.include_router(folders.router)
app.include_router(search.router)
app.include_router(import_backup.router)

@app.get("/")
async def root():
    return {"message": "Benvenuti! API is running and connected to MongoDB."}