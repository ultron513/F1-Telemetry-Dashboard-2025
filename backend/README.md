# Pit Wall API (backend)

FastAPI + FastF1 service that powers the dashboard. See the repository README for the full picture.

```bash
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000           # http://127.0.0.1:8000/docs
pytest                                               # runs offline against ../cache
```

All session endpoints live under `/api/v1/sessions/{season}/{round}/{session}` where
`session` is one of `FP1 FP2 FP3 Q SQ SS S R`.
