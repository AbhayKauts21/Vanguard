from fastapi import APIRouter

router = APIRouter(
    prefix="/admin",
    tags=["admin"]
)

@router.post("/ingest")
async def trigger_ingestion():
    """
    Trigger data ingestion from BookStack to Pinecone.
    """
    # TODO: Implement ingestion logic
    return {"message": "Ingestion process started."}
