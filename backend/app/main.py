from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import health, notifications, pyq, syllabus

app = FastAPI(title="Exam Prep API")

# The frontend is deployed separately on Netlify; loosen this to the real
# Netlify URL (and any custom domain) once KAN-71 is live — see docs/SETUP.md.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(notifications.router)
app.include_router(syllabus.router)
app.include_router(pyq.router)
