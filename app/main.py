from fastapi import FastAPI
from contextlib import asynccontextmanager
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

app.include_router(videos.router)
app.include_router(export.router)

@app.get("/")
async def root():
    return {"message": "Benvenuti! API is running and connected to MongoDB."}