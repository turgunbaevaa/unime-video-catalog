# UniMe Video Catalog — Project Plan & Architecture Guide

This document is both the implementation plan and an onboarding guide. 

## What we are building

The University of Messina records lectures that end up on Microsoft Stream with no structured, searchable catalog and no path into the university library system (OPAC). This project fixes that:

1. A **catalog** of video records (title, authors, date, tags, link to the video) stored in MongoDB, managed through a FastAPI backend — *already built, working*.
2. A **Next.js web UI** for staff to browse, create, edit, and delete records — *next thing to build*.
3. **Login via the university's Microsoft account** (Azure AD / Entra ID) so only authorized staff can use it.
4. **Automatic transcription** of videos, so lectures become searchable by what was *said*, not just by title.
5. **Automatic summarization** of transcripts using a locally-hosted LLM.
6. **MARCXML export** so lecture recordings appear in the university OPAC alongside books — *already built, working*.

## Team & responsibilities


### Supervisor: 
***Azure AD app registration, all OAuth/JWT code and configuration, Microsoft Graph/tenant investigations, code review and merges*** 
 
  Auth is not a student task: it requires tenant admin access and the supervisor has existing OAuth code (git.unime.it) and prior React experience. Students receive a **ready-made config file** with all Azure variables populated, plus working auth modules to *use*, not write. 
 
###  Students
**Frontend track**: ***the Next.js UI, Phases 1 and 2-integration*** Self-contained, immediate visual feedback, well-documented stack.

 **AI services track**: the transcription service and LLM summarization, Phases 3 and 4 
 
  Deliberately built as a *separate service* so it can be developed and tested without touching the catalog backend at all. Good thesis material: speech-to-text, model evaluation, service architecture.

The two tracks touch different codebases and can proceed in parallel with essentially zero merge conflicts. See the architecture rationale below.

**Staffing note:** tracks are defined by topic, not by person. Currently one student is confirmed; they start on the frontend track (Phases 1–2), which delivers a complete, usable product on its own. The AI services track is picked up by a second student if one joins — otherwise by the same student after Phase 2, or by the supervisor. Nothing in Phases 1–2 depends on the AI track existing, so the project is never blocked by missing staff.

## Architecture

```
                        ┌──────────────────────┐
   staff browser ─────► │  Next.js frontend    │   
                        │  frontend/           │
                        └─────────┬────────────┘
                                  │ HTTP + Bearer token (Phase 2+)
                                  ▼
                        ┌──────────────────────┐
   Azure AD  ◄────────► │  FastAPI backend     │ ◄──── MARCXML export to OPAC
   (login &             │  app/                │
    JWT check)          └─────────┬────────────┘
   (Supervisor)                   │
                                  ▼
                        ┌──────────────────────┐
                        │  MongoDB             │  video records + AI fields
                        └──────────────────────┘
                                  ▲
                                  │ writes transcript/summary into records
                        ┌─────────┴────────────┐
                        │  Transcription &     │   
                        │  summarization       │   separate service,
                        │  service             │   own repo folder / own process
                        └──────────────────────┘
                          │              │
                          ▼              ▼
                     faster-whisper   local LLM
                     (GPU machine)    (Ollama/llama.cpp/vLLM)
```

### Why is the frontend a separate app instead of FastAPI templates?

Separation of concerns: the backend exposes a clean JSON API and knows nothing about presentation; the frontend consumes that API and knows nothing about MongoDB. This means the two can be developed, tested, deployed, and *replaced* independently — and it means two people can work in parallel without stepping on each other. It also forces the API to be complete: if the UI can do something, any other client (a script, another university system) can do it too.

### Why MongoDB (documents) instead of a relational database?

A video record is a naturally nested document: it has a list of authors, a list of tags, an embedded `ai_processing` object with a list of transcript segments. In SQL this becomes 4–5 tables with joins; in MongoDB it is one document that matches exactly what the API sends and receives (look at `app/models/video.py` — the Pydantic models *are* the storage shape). The trade-off: MongoDB gives up cross-record transactions and enforced schemas, which we don't need here — records are independent of each other, and Pydantic enforces the schema at the API boundary instead.

### Why "soft delete"?

`DELETE /api/v1/videos/{id}` does not remove the record; it sets `is_deleted: true` and a timestamp. This is standard practice for catalog/archive systems: deletion by mistake is recoverable, and history is preserved. Real removal exists (`DELETE .../permanent`) but is a separate, deliberate act. Notice the list endpoint filters soft-deleted records out by default — the flag changes *visibility*, not existence.

### Why is transcription a separate service instead of code inside the backend?

Three reasons, in decreasing order of importance:

1. **Different resource lifecycle.** Transcription needs a GPU and heavy ML dependencies (faster-whisper, ffmpeg, CUDA). The catalog backend needs none of that and must stay light and always-on. Coupling them means the catalog can't be deployed without a GPU machine — absurd.
2. **Independent development.** Whoever builds it can develop and test the whole service with a folder of local video files, never touching (or breaking) the catalog. The only contract between the two systems is a small HTTP interface.
3. **Reusability.** A "give me audio/video, get back transcript" service is useful beyond this catalog.

The service exposes something like `POST /transcribe` (file upload or path) returning `{text, segments[], language}`. The catalog backend calls it over HTTP and writes the result into the record's `ai_processing` fields.

### Why validate JWTs on the backend when the frontend already does login?

When you log to a service, the server give you a grant an save it in your browser as a file... it's called JSON Web Token, and the S means that is signed (secure)... the backend must check if the token is valid. :-)

Because the frontend cannot be trusted — *any* HTTP client can call the API directly, bypassing the UI entirely. Login in the browser establishes who the user is and obtains a token; but **enforcement** must live on the server: every protected endpoint independently verifies the token's signature (against Microsoft's published public keys), issuer, audience, and expiry. The frontend check is UX; the backend check is security. This is the single most important security concept in the project.

### Why an "OpenAI-compatible" interface for the local LLM?

Ollama, llama.cpp's server, and vLLM all expose the same `/v1/chat/completions` HTTP shape popularized by OpenAI. By coding against that shape and putting the URL in an env var (`LOCAL_LLM_URL`), the choice of serving stack — and even the choice of model — becomes a configuration decision, not a code change. This is the same swappability idea as the transcription service, applied one level down.

---

## Phase 1 — Next.js prototype frontend, no auth *(frontend track)*

Goal: a working UI against the existing CRUD API. No login yet — auth is deliberately postponed so the first weeks produce something visible and testable without any Azure dependency.

- New `frontend/` app (Next.js, App Router) in this repo, calling the FastAPI backend over HTTP.
- Backend change needed (one line-ish, can be done by supervisor or the student): CORS middleware in `app/main.py` allowing the Next.js origin.
- Pages:
  - **Video list** — table of title, authors, tags, deleted-indicator → `GET /api/v1/videos/`.
  - **Create / edit form** — `POST /api/v1/videos/`, `PATCH /api/v1/videos/{id}`; field shapes are defined by `VideoCreate` / `VideoUpdate` in `app/models/video.py` (the interactive docs at `http://localhost:8000/docs` show them live).
  - **Detail view** — full record, including the `ai_processing` block (will show "pending"/empty until Phases 3–4 exist; build the UI slot for it now).
  - **Delete actions** — soft delete, and permanent delete behind a confirmation dialog.
- Definition of done: create → edit → soft-delete → restore-visibility (`?include_deleted=true`) round-trip works through the UI against a local backend.

## Phase 2 — Azure AD login *(Supervisor, with the frontend track integrating)*

Supervisor delivers:
- The Azure AD **app registration** (redirect URIs, exposed API scope, client secret) — done in the tenant portal, not by students.
- A **populated config file** (`.env` values: tenant ID, client ID, secret, audience) handed to the student — students never touch the Azure portal.
- Backend `app/auth.py`: FastAPI dependency validating Bearer JWTs (JWKS fetch + signature/issuer/audience/expiry checks), adapted from existing git.unime.it code. Applied to the video routes.
- A working NextAuth (Auth.js) configuration example for the frontend, adapted from prior React OAuth work.

Frontend track integrates:
- Add the login flow to the Phase 1 UI (NextAuth with the provided config), attach the session's Bearer token to every API call, handle the logged-out state.
- Definition of done: the Phase 1 flows all still work, but only after signing in with a university account; calling the API without a token returns 401.

## Phase 3 — Transcription service *(AI services track)*

Two source paths for getting a transcript, tried in this order:

**Path A — reuse Stream's own transcript** *(Supervisor investigates first — requires tenant access)*. Microsoft Stream auto-generates transcripts for hosted videos. Whether they are retrievable through a stable Microsoft Graph API is **unverified** (classic Stream's API is retired; Stream-on-SharePoint stores videos as files in document libraries). Supervisor checks via Graph Explorer / the Stream player's network traffic. If viable, Stream-hosted records get their transcript fetched directly — no GPU compute needed for them.

**Path B — the faster-whisper service** *(the AI track's main deliverable)*. Needed regardless of Path A's outcome, because the catalog must also handle content with no native transcript: local files, videos downloaded from the web, files uploaded by staff.

- Standalone FastAPI (or similar) service, its own folder (e.g. `transcriber/`), own dependencies, runs on the GPU machine.
- Interface: `POST /transcribe` accepting an uploaded file or a local path → `{text, segments: [{start_time, end_time, text}], language}` — matching the `TranscriptSegment` model already defined in `app/models/video.py`.
- Internals: audio extraction/normalization (ffmpeg) → faster-whisper. **The supervisor has existing working code for this pipeline — port it, don't rewrite it.**
- Catalog side (small, after the service works): `POST /api/v1/videos/{id}/transcribe` sets `ai_processing.status = "processing"`, calls the service, writes results back, sets `completed` or `failed`. Status is visible in the frontend's detail view — this is where the two tracks meet.
- Definition of done: a known video file goes in, and the record in MongoDB ends up with transcript, segments, language, and `status: completed`; a corrupted file ends with `status: failed`, not a stuck "processing".

Open modeling question (decide when reached, with supervisor): records currently assume `azure_stream_url` as the only source; local/web/uploaded content likely needs a `source_type` field.

## Phase 4 — LLM summarization *(AI services track)*

- Add summarization to the pipeline: read `whisper_transcript`, POST it to `LOCAL_LLM_URL` (OpenAI-compatible `/v1/chat/completions`), write the result to `ai_processing.llm_summary`.
- Triggerable independently (`POST /api/v1/videos/{id}/summarize`) so summaries can be re-run with better prompts/models without re-transcribing — transcription is expensive, summarization is cheap to redo.
- Interesting thesis-grade questions live here: prompt design for lecture summaries, chunking long transcripts that exceed the context window, comparing models/quantizations for quality vs. speed.
- The serving stack (Ollama / llama.cpp / vLLM) and model are TBD; the code must not care (see rationale above).

## Working agreements

- **English** for all code, comments, commits, and docs — the repo's working language.
- **Branches + pull requests**: nobody pushes to `main` directly; every PR is reviewed by the supervisor before merge. Small PRs (one feature/page/endpoint each) get reviewed fast; giant PRs sit.
- **Ask early**: being blocked for a day is normal; being silently blocked for a week is the only real failure mode. Write down what you tried.
- Each track keeps its own README section (or file) with setup steps, verified to work on a clean machine.

## Open items

1. **Path A verification** (Stream transcript via Graph API) — supervisor, early; the outcome reshapes how much of Phase 3 applies to Stream-hosted content.
2. **Path to the existing faster-whisper code** — supervisor shares; the AI track ports it into the `transcriber/` service.
3. **LLM serving stack and model choice** — decided during Phase 4, doesn't block anything.
4. **`source_type` modeling** for non-Stream content — decided when Phase 3 reaches it.
5. **Whether GET endpoints also require auth** — recommended yes (internal staff catalog); confirm during Phase 2.

## Verification

- **Phase 1**: manual round-trip through the UI (create/edit/soft-delete/permanent-delete) against a local backend + MongoDB.
- **Phase 2**: API rejects tokenless calls with 401; full flows work after real Azure AD sign-in; `pytest` for the JWT dependency (valid / expired / wrong-audience tokens).
- **Phase 3**: end-to-end run on a known video file → record populated, status `completed`; failure case → status `failed`. Status visible in the UI.
- **Phase 4**: summary generated for a completed transcript; re-running replaces it.
