import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.router_chat import router as chat_router
from app.api.router_admin import router as admin_router
from app.core.config import settings

def get_application() -> FastAPI:
    _app = FastAPI(
        title=settings.PROJECT_NAME,
        description="AI-powered customer support assistant backend",
        version="1.0.0",
    )

    _app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    _app.include_router(chat_router, prefix=settings.API_V1_STR)
    _app.include_router(admin_router, prefix=settings.API_V1_STR)

    return _app

app = get_application()

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
