from fastapi import FastAPI
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from app.database import client, database
from app.routers import videos
from app.routers import export

# Lifespan
@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await client.admin.command('ping')
        print("Successfully connected to MongoDB! 🎉")
    except Exception as e:
        print(f"Error connecting to MongoDB: {e}")
    yield

    client.close()
    print("MongoDB connection closed.")

app = FastAPI(
    title="UniMe Video Catalog API",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(videos.router)
app.include_router(export.router)

@app.get("/")
async def root():
    return {"message": "Benvenuti! API is running and connected to MongoDB."}