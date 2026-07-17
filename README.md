# 🎓 UniMe Video Catalog

![Python](https://img.shields.io/badge/python-3.11+-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.128-009688.svg)
![MongoDB](https://img.shields.io/badge/MongoDB-Motor%20(async)-47A248.svg)
![Status](https://img.shields.io/badge/status-in%20development-orange.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

A catalog for lecture videos at the **University of Messina** — searchable metadata records for Azure/Microsoft Stream-hosted videos, enriched with AI-generated transcripts and summaries, and exportable to the university library OPAC via MARCXML.

> 📚 **New to the project?** Read [`PLAN.md`](PLAN.md) — it's the onboarding guide and explains *why* the architecture looks the way it does, not just what to build. Current work items live in [`TASKS.md`](TASKS.md).

## ✨ What it does

Recorded lectures pile up on Microsoft Stream with no structured, searchable catalog and no path into the university library system. This project gives each recording a proper metadata record (title, authors, date, tags, link to the Azure-hosted video) so it can be:

- 🔍 **Discovered and managed** through a dedicated catalog instead of being lost in Stream
- 🤖 **Enriched automatically** with a transcript and summary via a speech-to-text + AI pipeline, making lectures searchable by content, not just by title
- 📖 **Published to the university OPAC** via MARCXML export, so lecture recordings show up alongside books and other library holdings

The videos themselves stay on Azure/Microsoft Stream — this system manages **records**, not video files.

## 🏗️ Architecture

```
Next.js frontend  ──►  FastAPI backend  ──►  MongoDB
   (planned)              app/                video records
                            │
                            ▼
                   Transcription & summarization service (planned)
                   faster-whisper + local LLM, separate process
```

| Component | Status | Tech |
|-----------|--------|------|
| Backend API (CRUD + MARCXML export) | ✅ working | FastAPI, Motor, Pydantic |
| Web UI | 🚧 next up | Next.js (App Router) |
| Authentication | 📋 planned | Azure AD / Entra ID |
| Transcription service | 📋 planned | faster-whisper, standalone service |
| AI summarization | 📋 planned | local LLM (OpenAI-compatible API) |

## 🚀 Quick start

### Prerequisites

- Python 3.11+
- Docker (for MongoDB) — or any reachable MongoDB instance

### 1. Clone and install

```bash
git clone <repo-url>
cd unime-video-catalog
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Start MongoDB

```bash
docker compose -f app/docker-compose.yml up -d
```

### 3. Run the API

```bash
uvicorn app.main:app --reload
```

Open **http://localhost:8000/docs** for the interactive API documentation (Swagger UI) — you can try every endpoint from the browser.

## ⚙️ Configuration

Configuration is read from environment variables (a `.env` file at the project root works too):

| Variable | Default | Description |
|----------|---------|-------------|
| `MONGO_URL` | `mongodb://localhost:27017` | MongoDB connection string |

More variables (Azure AD, LLM endpoint) will be added as the planned phases land — see [`PLAN.md`](PLAN.md).

## 📡 API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Health check |
| `POST` | `/api/v1/videos/` | Create a video record (metadata + Azure URL) |
| `GET` | `/api/v1/videos/` | List records (add `?include_deleted=true` to include soft-deleted) |
| `GET` | `/api/v1/videos/{id}` | Get a single record |
| `PATCH` | `/api/v1/videos/{id}` | Update one or more fields |
| `DELETE` | `/api/v1/videos/{id}` | Soft-delete (recoverable) |
| `DELETE` | `/api/v1/videos/{id}/permanent` | Permanent delete (irreversible) |
| `GET` | `/api/v1/export/marcxml` | Export the catalog as MARCXML for the OPAC |

## 📁 Project structure

```
.
├── app/                     # FastAPI backend
│   ├── main.py              # Entry point, lifespan, router mounting
│   ├── database.py          # MongoDB connection (Motor)
│   ├── docker-compose.yml   # MongoDB service for local development
│   ├── models/
│   │   └── video.py         # Pydantic models (VideoCreate, VideoResponse, AIData, ...)
│   └── routers/
│       ├── videos.py        # Video record CRUD
│       └── export.py        # MARCXML export
├── PLAN.md                  # Architecture guide & roadmap — start here
├── TASKS.md                 # Current work items, by track
└── requirements.txt
```

## 🤝 Contributing

Ground rules:

1. **Never push to `main`** — create a branch (`feature/<short-name>`), open a pull request, and wait for review.
2. **Small PRs** — one feature, page, or endpoint per PR. Small PRs get reviewed fast.
3. **English everywhere** — code, comments, commit messages, docs.
4. **Commit messages**: short imperative summary line (`Add video detail page`), details in the body if needed.
5. **Stuck?** Ask early. Write down what you tried — "I expected X, got Y, tried Z" is the fastest way to get unblocked.

Typical workflow:

```bash
git checkout -b feature/video-list-page
# ... work, commit as you go ...
git push -u origin feature/video-list-page
# then open a Pull Request on GitHub and request review
```

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<sub>University of Messina · lecture video cataloging · FastAPI + MongoDB + Next.js</sub>
