"""Voice router — TTS synthesis endpoint for the voice pipeline.

Phase V2: Provides POST /voice/tts to convert text into audio (MP3).
Supports both full-body and streaming responses.
"""

import time
from fastapi import APIRouter, Request
from fastapi.responses import Response, StreamingResponse

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings
from app.core.logging import get_request_logger
from app.domain.schemas import TTSRequest
from app.services.tts_service import tts_service

limiter = Limiter(key_func=get_remote_address)

router = APIRouter(
    prefix="/voice",
    tags=["voice"],
)


_rate = f"{settings.RATE_LIMIT_PER_MINUTE}/minute"


@router.post("/tts", summary="Text-to-Speech synthesis")
@limiter.limit(_rate)
async def tts(request: Request, body: TTSRequest):
    """Synthesize text to audio and return as binary MP3 response.

    When ``stream=true`` in the request body the response is a chunked
    streaming response suitable for progressive playback.
    """
    rlog = get_request_logger(request)
    rlog.info(
        "request.received",
        endpoint="/voice/tts",
        method="POST",
        text_length=len(body.text),
        stream=body.stream,
    )
    t0 = time.perf_counter()

    if body.stream:
        # Streaming response — chunked transfer encoding.
        async def audio_stream():
            async for chunk in tts_service.synthesize_stream(
                text=body.text,
                voice=body.voice,
                language=body.language,
            ):
                yield chunk

        rlog.info(
            "request.streaming",
            endpoint="/voice/tts",
            duration_ms=round((time.perf_counter() - t0) * 1000, 1),
        )

        return StreamingResponse(
            audio_stream(),
            media_type=tts_service.content_type(),
            headers={
                "Content-Disposition": "inline",
                "Cache-Control": "no-cache",
            },
        )

    # Full body response.
    try:
        audio_bytes = await tts_service.synthesize(
            text=body.text,
            voice=body.voice,
            language=body.language,
        )
    except Exception as e:
        rlog.error("request.failed", endpoint="/voice/tts", error=str(e))
        return Response(content=str(e), status_code=500)

    rlog.info(
        "request.completed",
        endpoint="/voice/tts",
        status=200,
        text=body.text[:20],
        duration_ms=round((time.perf_counter() - t0) * 1000, 1),
    )

    if not audio_bytes:
        rlog.warning("request.empty_audio", endpoint="/voice/tts", text=body.text)
        # We still return 200 but zero length, which helps debug if it's arriving as zero.

    return Response(
        content=audio_bytes,
        media_type=tts_service.content_type(),
        headers={
            "Content-Disposition": "inline",
            "Content-Length": str(len(audio_bytes)),
            "Cache-Control": "no-cache",
        },
    )


@router.get("/voices", summary="List available TTS voices")
@limiter.limit(_rate)
async def list_voices(request: Request):
    """Return the currently configured TTS voice and format metadata.

    A future enhancement could query Azure for all available neural voices.
    """
    return {
        "default_voice": settings.AZURE_TTS_VOICE,
        "output_format": settings.AZURE_TTS_OUTPUT_FORMAT,
        "region": settings.AZURE_SPEECH_REGION,
    }
