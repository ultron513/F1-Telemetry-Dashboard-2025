from fastapi import APIRouter

router = APIRouter(
    prefix="/health",
    tags=["Health"]
)


@router.get("/")
def health():

    return {
        "status": "healthy",
        "service": "F1 Engineering Analytics API"
    }