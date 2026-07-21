# Task list

Work items implementing `PLAN.md`, split by track (topic, not person — see the staffing note in `PLAN.md`). One task ≈ one small PR.

## Supervisor track

- [ ] **S1.** Verify whether Stream's auto-transcript is retrievable via Microsoft Graph (Path A) — Graph Explorer on a captioned video's driveItem children + Stream player network inspection. Outcome reshapes Phase 3 scope.
- [ ] **S2.** Share the existing faster-whisper (normalization + transcription) code with whoever takes the AI track.
- [ ] **S3.** Create the Azure AD app registration (redirect URIs for localhost + prod, exposed API scope, Graph application permissions, client secret).
- [ ] **S4.** Produce the populated config file (`.env` values) for the student(s).
- [ ] **S5.** Backend `app/auth.py` — JWT validation dependency (adapt from git.unime.it code), applied to video routes.
- [ ] **S6.** NextAuth configuration example for the frontend.
- [x] **S7.** Ongoing: review and merge all PRs.

## Frontend track — Next.js UI *(currently staffed)*

### Phase 1 (no auth) ✅ — completed

- [x] **F1.** Scaffold `frontend/` Next.js app (App Router); CORS middleware added to `app/main.py`.
- [x] **F2.** API client module (`frontend/src/lib/api.ts`) — typed functions wrapping all five backend endpoints.
- [x] **F3.** Video list page — grid with title, authors, tags, deleted indicator, archive toggle.
- [x] **F4.** Create form — fields matching `VideoCreate`, split-tags input, redirects to list on success.
- [x] **F5.** Edit form — `PATCH` with only changed fields, pre-filled from existing data.
- [x] **F6.** Detail view — full record incl. `ai_processing` block (status badge, transcript/summary slots, empty-state).
- [x] **F7.** Delete actions — soft delete (archive) inline; permanent delete behind confirmation modal.
- [x] **F8.** Frontend setup README in `frontend/README.md`.

### Phase 2 (auth integration)

- [ ] **F9.** Integrate NextAuth with the supervisor-provided config; login/logout UI, logged-out state.
- [ ] **F10.** Attach Bearer token to all API calls; handle 401 (redirect to login).

## AI services track — transcription & summarization *(unstaffed for now — second student, or same student after Phase 2, or supervisor)*

### Phase 3 (transcription service)

- [ ] **AI1.** Scaffold `transcriber/` standalone service (own folder, own requirements, own README).
- [ ] **AI2.** `POST /transcribe` endpoint accepting a file upload or local path; response shape `{text, segments[], language}` matching `TranscriptSegment` in `app/models/video.py`.
- [ ] **AI3.** Port the supervisor's ffmpeg normalization + faster-whisper code into the service (after S2).
- [ ] **AI4.** Error handling: corrupted/unsupported input → clean error response, never a hang.
- [ ] **AI5.** Catalog integration: `POST /api/v1/videos/{id}/transcribe` on the backend — status transitions `pending → processing → completed/failed`, results written to `ai_processing`.
- [ ] **AI6.** Decide `source_type` modeling for local/web/uploaded content (with supervisor).

### Phase 4 (summarization)

- [ ] **AI7.** Summarization call against `LOCAL_LLM_URL` (OpenAI-compatible `/v1/chat/completions`), writing `ai_processing.llm_summary`.
- [ ] **AI8.** `POST /api/v1/videos/{id}/summarize` — independently triggerable / re-runnable.
- [ ] **AI9.** Transcript chunking strategy for lectures exceeding the model's context window.
- [ ] **AI10.** Evaluate serving stacks + models (Ollama / llama.cpp / vLLM; quantization vs quality) — document findings.

## Sequencing notes

- F1–F8 need nothing from anyone (backend already works) — this is where the confirmed student starts.
- The AI track is fully decoupled: AI1–AI4 need only S2, and no frontend work depends on it. If it stays unstaffed, the catalog (Phases 1–2) is still a complete, usable product.
- S1 should happen early — it determines how much of Phase 3 applies to Stream-hosted videos.
- F9–F10 wait on S3–S6. AI5 waits on AI2–AI3.

## Housekeeping

I vecchi branch `feature/*` sono stati mergiati in `main` e possono essere eliminati da remoto:
```bash
git push origin --delete feature/frontend-setup feature/api-client feature/video-list-page feature/new-video-form feature/delete-actions feature/ui-modal-confirm feature/archive-page feature/video-detail
```
