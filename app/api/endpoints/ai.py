from datetime import datetime
import json
import logging
import time
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Any, Optional

logger = logging.getLogger("ai_timing")
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("[%(levelname)s] %(asctime)s %(message)s"))
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)

from app.api.dependencies import get_db, get_current_user
from app.db.database import SessionLocal
from fastapi.responses import JSONResponse, StreamingResponse
from app.db.models import (
    Submission, User, Problem, TestCase, VerdictEnum,
    AIComplexityAnalysis, AITutorConversation, AIGeneralChatLog
)
from app.schemas.ai import (
    AITutorHintResponse,
    AIComplexityResponse,
    AIChatRequest,
    AIChatResponse,
    AIChatMessage,
    AIChatSummaryItem,
    GeneralAIChatRequest,
    GeneralAIChatResponse,
    AIHintEnqueueRequest,
    AIHintTaskEnqueuedResponse,
    AIHintTaskStatusResponse
)
from app.services.ai import (
    generate_tutor_hint,
    async_generate_tutor_hint,
    stream_tutor_hint,
    generate_tutor_chat_reply,
    generate_general_chat_reply,
    analyze_complexity,
    compute_code_hash,
    OperationBreakdownItem
)
from app.core.config import settings
from app.core.redis import get_redis_client
from app.services.ai_tasks import generate_ai_hint_task
from app.services.ai_cache import (
    build_hint_cache_key,
    get_cached_hint,
    set_cached_hint,
    acquire_inflight_lock,
    get_inflight_task,
    release_inflight_lock
)
from app.services.ai_resilience import (
    check_user_rate_limit,
    is_circuit_open,
    get_graceful_fallback_hint
)
from celery.result import AsyncResult

router = APIRouter()

_429_response = {
    "description": "Rate limit exceeded. Retry-After header indicates when to retry.",
    "content": {"application/json": {"example": {"detail": "Rate limit exceeded: max 5 AI requests per minute."}}}
}
_403_response = {"description": "Not authorized to access this resource."}
_404_response = {"description": "Resource not found."}

@router.get(
    "/user/history",
    response_model=List[AIChatSummaryItem],
    summary="Get user AI chat history",
    description="Retrieves a summarized history of all Socratic AI Tutor chats and General AI conversations for the authenticated user.",
    responses={403: _403_response}
)
def get_user_ai_chat_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Fetch all AI conversation summaries for the current user."""
    results = []

    # 1. Socratic Tutor chats
    sub_ids = db.query(AITutorConversation.submission_id).filter(
        AITutorConversation.user_id == current_user.id
    ).group_by(AITutorConversation.submission_id).all()

    for (s_id,) in sub_ids:
        submission = db.query(Submission).filter(Submission.id == s_id).first()
        if not submission:
            continue
        problem = db.query(Problem).filter(Problem.id == submission.problem_id).first()
        msg_count = db.query(AITutorConversation).filter(AITutorConversation.submission_id == s_id).count()
        last_msg = db.query(AITutorConversation).filter(
            AITutorConversation.submission_id == s_id
        ).order_by(AITutorConversation.created_at.desc()).first()

        results.append(AIChatSummaryItem(
            chat_type="tutor",
            session_id=None,
            submission_id=s_id,
            problem_id=submission.problem_id,
            problem_title=problem.title if problem else "Problem",
            verdict=submission.verdict.name if submission.verdict else "UNKNOWN",
            message_count=msg_count,
            last_updated=last_msg.created_at if last_msg else submission.created_at
        ))

    # 2. General AI Assistant chats
    gen_sessions = db.query(AIGeneralChatLog.session_id).filter(
        AIGeneralChatLog.user_id == current_user.id
    ).group_by(AIGeneralChatLog.session_id).all()

    for (sess_id,) in gen_sessions:
        first_user_msg = db.query(AIGeneralChatLog).filter(
            AIGeneralChatLog.session_id == sess_id,
            AIGeneralChatLog.role == "user"
        ).order_by(AIGeneralChatLog.created_at.asc()).first()

        title_text = "General AI Chat"
        if first_user_msg and first_user_msg.content:
            title_text = first_user_msg.content[:45] + ("..." if len(first_user_msg.content) > 45 else "")

        msg_count = db.query(AIGeneralChatLog).filter(AIGeneralChatLog.session_id == sess_id).count()
        last_msg = db.query(AIGeneralChatLog).filter(
            AIGeneralChatLog.session_id == sess_id
        ).order_by(AIGeneralChatLog.created_at.desc()).first()

        results.append(AIChatSummaryItem(
            chat_type="general",
            session_id=sess_id,
            submission_id=None,
            problem_id=None,
            problem_title=title_text,
            verdict=None,
            message_count=msg_count,
            last_updated=last_msg.created_at if last_msg else datetime.now()
        ))

    results.sort(key=lambda x: x.last_updated, reverse=True)
    return results

@router.post(
    "/general-chat",
    response_model=GeneralAIChatResponse,
    summary="General AI Assistant chat turn",
    description="Interacts with the persistent general coding AI assistant, with context of problem, code, and session history.",
    responses={403: _403_response, 429: _429_response}
)
def persistent_general_ai_chat(
    chat_in: GeneralAIChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Send a message to the general AI assistant and record the turn in DB history."""
    session_id = chat_in.session_id or f"gen_{current_user.id}_{int(datetime.now().timestamp())}"
    
    problem_title = None
    problem_desc = None
    if chat_in.problem_id:
        problem = db.query(Problem).filter(Problem.id == chat_in.problem_id).first()
        if problem:
            problem_title = problem.title
            problem_desc = problem.description

    reply_text = generate_general_chat_reply(
        message=chat_in.message,
        problem_title=problem_title,
        problem_description=problem_desc,
        current_code=chat_in.current_code,
        history=chat_in.history or []
    )

    # Persist chat history into DB
    db.add(AIGeneralChatLog(
        user_id=current_user.id,
        problem_id=chat_in.problem_id,
        session_id=session_id,
        role="user",
        content=chat_in.message
    ))
    db.add(AIGeneralChatLog(
        user_id=current_user.id,
        problem_id=chat_in.problem_id,
        session_id=session_id,
        role="assistant",
        content=reply_text
    ))
    db.commit()

    return GeneralAIChatResponse(reply=reply_text, session_id=session_id)

@router.get(
    "/general-chat/{session_id}/history",
    response_model=List[AIChatMessage],
    summary="Get General AI chat history",
    description="Loads the chronological chat transcript for a specific general AI chat session.",
    responses={403: _403_response}
)
def get_general_chat_history(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Retrieve all messages in a general AI chat session."""
    records = db.query(AIGeneralChatLog).filter(
        AIGeneralChatLog.session_id == session_id,
        AIGeneralChatLog.user_id == current_user.id
    ).order_by(AIGeneralChatLog.created_at.asc()).all()

    return [AIChatMessage(role=r.role, content=r.content, created_at=r.created_at) for r in records]

def enqueue_hint_submission(
    submission_id: int,
    current_user: User,
    db: Session,
    help_level: str = "concise_hint",
    request_id: Optional[str] = None
) -> AIHintTaskEnqueuedResponse:
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    if submission.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to request AI hint for this submission")

    problem = db.query(Problem).filter(Problem.id == submission.problem_id).first()
    if not problem:
        raise HTTPException(status_code=404, detail="Associated problem not found")

    task_id = f"hint_{submission_id}_{uuid.uuid4().hex[:10]}"
    redis_client = get_redis_client()
    task_key = f"ai_task:{task_id}"
    verdict_str = submission.verdict.name if submission.verdict else "UNKNOWN"

    # Step 1: Check Deterministic Cache Key (Phase 4)
    cache_key = build_hint_cache_key(
        problem_id=submission.problem_id,
        code=submission.code,
        language=submission.language,
        verdict=verdict_str,
        help_level=help_level,
        prompt_version=settings.PROMPT_VERSION,
        model_name=settings.AI_MODEL
    )
    cached_result = get_cached_hint(cache_key)
    if cached_result:
        cached_payload = {
            "task_id": task_id,
            "user_id": current_user.id,
            "submission_id": submission_id,
            "status": "done",
            "cached": True,
            "result": cached_result,
            "completed_at": time.time()
        }
        redis_client.set(task_key, json.dumps(cached_payload), ex=settings.AI_RESULT_TTL_SECONDS)
        return AIHintTaskEnqueuedResponse(
            task_id=task_id,
            status="done",
            submission_id=submission_id,
            message="AI hint retrieved from cache instantly (cached=true)",
            cached=True,
            estimated_wait_seconds=0
        )

    # Rate limiting for non-cached AI generation requests (Phase 5)
    allowed, retry_after, error_msg = check_user_rate_limit(current_user.id)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=error_msg,
            headers={"Retry-After": str(retry_after)}
        )

    # Step 2: Prevent Cache Stampede via In-Flight Lock (Phase 4)
    inflight_id = get_inflight_task(cache_key)
    if inflight_id:
        alias_payload = {
            "task_id": task_id,
            "user_id": current_user.id,
            "submission_id": submission_id,
            "status": "pending",
            "attached_to": inflight_id,
            "cache_key": cache_key,
            "enqueued_at": time.time()
        }
        redis_client.set(task_key, json.dumps(alias_payload), ex=settings.AI_RESULT_TTL_SECONDS)
        return AIHintTaskEnqueuedResponse(
            task_id=task_id,
            status="pending",
            submission_id=submission_id,
            message="Attached to in-flight AI generation (stampede prevented)",
            cached=False,
            estimated_wait_seconds=2
        )

    # Acquire in-flight marker for this cache key
    acquire_inflight_lock(cache_key, task_id)

    # Check if conversation already exists in DB
    existing_convo = db.query(AITutorConversation).filter(
        AITutorConversation.submission_id == submission_id
    ).order_by(AITutorConversation.created_at.asc()).all()

    if existing_convo:
        release_inflight_lock(cache_key)
        first_msg = existing_convo[0].content
        parts = first_msg.split("\n\n**Hint 1:** ")
        what_went_wrong = parts[0].replace("**Diagnosed Error:** ", "") if len(parts) > 0 else "Analysis completed."
        hint_1 = parts[1] if len(parts) > 1 else "Check your code structure."
        db_cached = {
            "what_went_wrong": what_went_wrong,
            "hint_1": hint_1,
            "hint_2": "Review your loop boundaries and constraints.",
            "strong_hint": "Verify your testcases against edge values.",
            "edge_case": "Boundary conditions",
            "where_to_look": "Main logic block",
            "concept": "Algorithm logic",
            "confidence": "High"
        }
        set_cached_hint(cache_key, db_cached, ttl=settings.AI_CACHE_TTL_SECONDS)
        cached_payload = {
            "task_id": task_id,
            "user_id": current_user.id,
            "submission_id": submission_id,
            "status": "done",
            "cached": True,
            "result": db_cached,
            "completed_at": time.time()
        }
        redis_client.set(task_key, json.dumps(cached_payload), ex=settings.AI_RESULT_TTL_SECONDS)
        return AIHintTaskEnqueuedResponse(
            task_id=task_id,
            status="done",
            submission_id=submission_id,
            message="AI hint retrieved from conversation cache (cached=true)",
            cached=True,
            estimated_wait_seconds=0
        )

    # Record initial pending state in Redis
    initial_payload = {
        "task_id": task_id,
        "user_id": current_user.id,
        "submission_id": submission_id,
        "status": "pending",
        "cache_key": cache_key,
        "enqueued_at": time.time()
    }
    redis_client.set(task_key, json.dumps(initial_payload), ex=settings.AI_RESULT_TTL_SECONDS)

    generate_ai_hint_task.apply_async(
        args=[
            submission.id,
            current_user.id,
            problem.title,
            problem.description,
            submission.code,
            verdict_str,
            help_level,
            request_id,
            cache_key
        ],
        task_id=task_id
    )

    return AIHintTaskEnqueuedResponse(
        task_id=task_id,
        status="pending",
        submission_id=submission_id,
        message="AI hint generation enqueued successfully",
        cached=False,
        estimated_wait_seconds=3
    )

@router.post(
    "/hint",
    response_model=AIHintTaskEnqueuedResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Enqueue AI hint generation",
    description="Enqueues an async Celery task to generate an AI hint for a submission. Returns immediately with a task_id for polling. Returns cached result instantly if available.",
    responses={429: _429_response, 403: _403_response, 404: _404_response}
)
def enqueue_ai_hint(
    req: AIHintEnqueueRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Enqueue an AI hint generation task or return a cached result."""
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    return enqueue_hint_submission(
        submission_id=req.submission_id,
        current_user=current_user,
        db=db,
        help_level=req.help_level or "concise_hint",
        request_id=request_id
    )

@router.post(
    "/hint/{submission_id}",
    response_model=AIHintTaskEnqueuedResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Enqueue AI hint by submission ID",
    description="Shortcut to enqueue AI hint generation using a submission ID path parameter with default help_level.",
    responses={429: _429_response, 403: _403_response, 404: _404_response}
)
def enqueue_ai_hint_by_id(
    submission_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Enqueue AI hint generation for a specific submission."""
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    return enqueue_hint_submission(
        submission_id=submission_id,
        current_user=current_user,
        db=db,
        help_level="concise_hint",
        request_id=request_id
    )

@router.get(
    "/hint/{task_id}",
    response_model=AIHintTaskStatusResponse,
    summary="Poll AI hint task status",
    description="Returns the current status of an enqueued AI hint task. Only the task owner (or admin) may access the result. Resolves stampede-protected attached tasks.",
    responses={403: _403_response, 404: _404_response}
)
def get_ai_hint_task_status(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Poll status and result of an AI hint generation task."""
    redis_client = get_redis_client()
    task_key = f"ai_task:{task_id}"
    data_raw = redis_client.get(task_key)

    if data_raw:
        task_data = json.loads(data_raw)
        # Check task ownership
        if task_data.get("user_id") != current_user.id and not current_user.is_admin:
            raise HTTPException(status_code=403, detail="Not authorized to view this task result")

        # Resolve attached stampede-protected tasks (Phase 4)
        if task_data.get("attached_to"):
            attached_raw = redis_client.get(f"ai_task:{task_data['attached_to']}")
            if attached_raw:
                attached_data = json.loads(attached_raw)
                res = attached_data.get("result")
                return AIHintTaskStatusResponse(
                    task_id=task_id,
                    status=attached_data.get("status", "pending"),
                    submission_id=task_data.get("submission_id"),
                    result=AITutorHintResponse(**res) if res else None,
                    error_message=attached_data.get("error_message"),
                    cached=True
                )
            if task_data.get("cache_key"):
                cached_res = get_cached_hint(task_data["cache_key"])
                if cached_res:
                    return AIHintTaskStatusResponse(
                        task_id=task_id,
                        status="done",
                        submission_id=task_data.get("submission_id"),
                        result=AITutorHintResponse(**cached_res),
                        cached=True
                    )

        task_status = task_data.get("status", "pending")
        result = task_data.get("result")
        est_wait = 2 if task_status == "pending" else (1 if task_status == "running" else 0)
        return AIHintTaskStatusResponse(
            task_id=task_id,
            status=task_status,
            submission_id=task_data.get("submission_id"),
            result=AITutorHintResponse(**result) if result else None,
            error_message=task_data.get("error_message"),
            cached=task_data.get("cached", False),
            estimated_wait_seconds=est_wait
        )

    # Fallback: check Celery result backend directly
    celery_res = AsyncResult(task_id)
    celery_status = celery_res.status.lower()
    if celery_status in ("pending", "received"):
        return AIHintTaskStatusResponse(task_id=task_id, status="pending")
    elif celery_status in ("started", "retry"):
        return AIHintTaskStatusResponse(task_id=task_id, status="running")
    elif celery_status == "success":
        res_dict = celery_res.result
        if isinstance(res_dict, dict) and "result" in res_dict:
            res_content = res_dict["result"]
            return AIHintTaskStatusResponse(
                task_id=task_id,
                status="done",
                result=AITutorHintResponse(**res_content) if isinstance(res_content, dict) else None,
                cached=res_dict.get("cached", False)
            )
        return AIHintTaskStatusResponse(task_id=task_id, status="done")
    elif celery_status == "failure":
        return AIHintTaskStatusResponse(task_id=task_id, status="failed", error_message=str(celery_res.result))

    raise HTTPException(status_code=404, detail="AI hint task not found or expired")

async def generate_hint_sse_stream(
    submission: Submission,
    problem: Problem,
    current_user: User,
    request: Request,
    help_level: str = "concise_hint"
):
    """Generates Server-Sent Events (SSE) streaming tokens with disconnect monitoring."""
    full_text_parts = []
    is_client_connected = True

    try:
        verdict_str = submission.verdict.name if submission.verdict else "UNKNOWN"

        # Check Cache before streaming (Phase 4)
        cache_key = build_hint_cache_key(
            problem_id=submission.problem_id,
            code=submission.code,
            language=submission.language,
            verdict=verdict_str,
            help_level=help_level,
            prompt_version=settings.PROMPT_VERSION,
            model_name=settings.AI_MODEL
        )
        cached_data = get_cached_hint(cache_key)
        if cached_data:
            full_text = f"**Diagnosed Error:** {cached_data.get('what_went_wrong', '')}\n\n**Hint 1:** {cached_data.get('hint_1', '')}"
            for word in full_text.split(" "):
                if await request.is_disconnected():
                    return
                yield f"data: {json.dumps({'token': word + ' '})}\n\n"
            yield f"data: {json.dumps({'done': True, 'full_text': full_text, 'cached': True})}\n\n"
            return

        # Check circuit breaker before live generation
        if is_circuit_open():
            fallback = get_graceful_fallback_hint(problem.title, verdict_str, "temporary service cooldown")
            full_text = f"**Diagnosed Error:** {fallback.what_went_wrong}\n\n**Hint 1:** {fallback.hint_1}"
            for word in full_text.split(" "):
                if await request.is_disconnected():
                    return
                yield f"data: {json.dumps({'token': word + ' '})}\n\n"
            yield f"data: {json.dumps({'done': True, 'full_text': full_text, 'cached': True, 'fallback': True})}\n\n"
            return

        async for token in stream_tutor_hint(
            problem_title=problem.title,
            problem_description=problem.description,
            user_code=submission.code,
            verdict=verdict_str,
            help_level=help_level
        ):
            # Check client disconnect cleanly on each chunk
            if await request.is_disconnected():
                logger.info("Client disconnected from SSE stream for submission %s", submission.id)
                is_client_connected = False
                break

            full_text_parts.append(token)
            payload = json.dumps({"token": token})
            yield f"data: {payload}\n\n"

        if is_client_connected:
            full_text = "".join(full_text_parts)
            done_payload = json.dumps({"done": True, "full_text": full_text})
            yield f"data: {done_payload}\n\n"

            # Persist full assistant reply to DB conversation
            try:
                db_session = SessionLocal()
                db_session.add(AITutorConversation(
                    submission_id=submission.id,
                    user_id=current_user.id,
                    role="assistant",
                    content=full_text
                ))
                db_session.commit()
                db_session.close()
            except Exception as dbe:
                logger.error("Failed to persist streamed conversation: %s", dbe)

    except Exception as e:
        logger.error("Exception in SSE stream for submission %s: %s", submission.id, e)
        error_payload = json.dumps({"error": True, "message": f"Streaming service issue: {str(e)}"})
        yield f"data: {error_payload}\n\n"

@router.get(
    "/hint/stream",
    summary="Stream AI hints via SSE",
    description="Streams real-time Server-Sent Events (SSE) tokens generated by Gemini for a submission with client-disconnect cancellation.",
    responses={429: _429_response, 403: _403_response, 404: _404_response}
)
@router.get(
    "/hint/stream/{submission_id}",
    summary="Stream AI hints via SSE by submission ID",
    description="Streams real-time Server-Sent Events (SSE) tokens generated by Gemini for a specific submission ID.",
    responses={429: _429_response, 403: _403_response, 404: _404_response}
)
async def stream_ai_hint(
    submission_id: int,
    request: Request,
    help_level: str = "concise_hint",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Real-time SSE token stream for AI tutor hints."""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    if submission.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to stream AI hint for this submission")

    problem = db.query(Problem).filter(Problem.id == submission.problem_id).first()
    if not problem:
        raise HTTPException(status_code=404, detail="Associated problem not found")

    verdict_str = submission.verdict.name if submission.verdict else "UNKNOWN"
    cache_key = build_hint_cache_key(
        problem_id=submission.problem_id,
        code=submission.code,
        language=submission.language,
        verdict=verdict_str,
        help_level=help_level,
        prompt_version=settings.PROMPT_VERSION,
        model_name=settings.AI_MODEL
    )
    cached_data = get_cached_hint(cache_key)
    if not cached_data and not is_circuit_open():
        allowed, retry_after, error_msg = check_user_rate_limit(current_user.id)
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=error_msg,
                headers={"Retry-After": str(retry_after)}
            )

    return StreamingResponse(
        generate_hint_sse_stream(
            submission=submission,
            problem=problem,
            current_user=current_user,
            request=request,
            help_level=help_level
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@router.post(
    "/tutor/{submission_id}",
    summary="Get or enqueue AI Socratic tutor hint",
    description="Hybrid endpoint: by default returns HTTP 202 with an enqueued task_id for Celery async execution. If ?sync=true is specified, executes synchronously.",
    responses={202: {"description": "Task enqueued asynchronously"}, 429: _429_response, 403: _403_response, 404: _404_response}
)
async def get_ai_tutor_hint(
    submission_id: int,
    request: Request,
    sync: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Diagnose submission failure and generate or enqueue Socratic hints."""
    # If synchronous mode is requested or enabled in settings, run directly
    if sync or settings.AI_SYNC_MODE:
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        t_start = time.perf_counter()

        t_db_start = time.perf_counter()
        submission = db.query(Submission).filter(Submission.id == submission_id).first()
        if not submission:
            raise HTTPException(status_code=404, detail="Submission not found")
        
        if submission.user_id != current_user.id and not current_user.is_admin:
            raise HTTPException(status_code=403, detail="Not authorized to view AI tutor for this submission")

        problem = db.query(Problem).filter(Problem.id == submission.problem_id).first()
        if not problem:
            raise HTTPException(status_code=404, detail="Associated problem not found")

        existing_convo = db.query(AITutorConversation).filter(
            AITutorConversation.submission_id == submission_id
        ).order_by(AITutorConversation.created_at.asc()).all()
        db_fetch_ms = (time.perf_counter() - t_db_start) * 1000

        if existing_convo:
            first_msg = existing_convo[0].content
            parts = first_msg.split("\n\n**Hint 1:** ")
            what_went_wrong = parts[0].replace("**Diagnosed Error:** ", "") if len(parts) > 0 else "Analysis completed."
            hint_1 = parts[1] if len(parts) > 1 else "Check your code structure."
            total_ms = (time.perf_counter() - t_start) * 1000
            timing_payload = {
                "event": "ai_hint_timing",
                "request_id": request_id,
                "cached_convo": True,
                "db_fetch_ms": round(db_fetch_ms, 2),
                "prompt_build_ms": 0.0,
                "gemini_call_ms": 0.0,
                "celery_queue_wait_ms": 0.0,
                "total_request_ms": round(total_ms, 2)
            }
            logger.info(json.dumps(timing_payload))
            return AITutorHintResponse(
                what_went_wrong=what_went_wrong,
                hint_1=hint_1,
                hint_2="Review your loop boundaries and constraints.",
                strong_hint="Verify your testcases against edge values.",
                edge_case="Boundary conditions",
                where_to_look="Main logic block",
                concept="Algorithm logic",
                confidence="Medium"
            )

        verdict_str = submission.verdict.name if submission.verdict else "UNKNOWN"

        allowed, retry_after, error_msg = check_user_rate_limit(current_user.id)
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=error_msg,
                headers={"Retry-After": str(retry_after)}
            )

        if is_circuit_open():
            return get_graceful_fallback_hint(problem.title, verdict_str, "temporary service cooldown")

        timing_collector: dict = {}
        hint_response = await async_generate_tutor_hint(
            problem_title=problem.title,
            problem_description=problem.description,
            user_code=submission.code,
            verdict=verdict_str,
            help_level="concise_hint",
            request_id=request_id,
            timing_collector=timing_collector
        )

        initial_summary = f"**Diagnosed Error:** {hint_response.what_went_wrong}\n\n**Hint 1:** {hint_response.hint_1}"
        db.add(AITutorConversation(
            submission_id=submission_id,
            user_id=current_user.id,
            role="assistant",
            content=initial_summary
        ))
        db.commit()

        total_ms = (time.perf_counter() - t_start) * 1000
        timing_payload = {
            "event": "ai_hint_timing",
            "request_id": request_id,
            "cached_convo": False,
            "db_fetch_ms": round(db_fetch_ms, 2),
            "prompt_build_ms": round(timing_collector.get("prompt_build_ms", 0.0), 2),
            "gemini_call_ms": round(timing_collector.get("gemini_call_ms", 0.0), 2),
            "celery_queue_wait_ms": 0.0,
            "total_request_ms": round(total_ms, 2)
        }
        logger.info(json.dumps(timing_payload))
        return hint_response

    # Default: non-blocking async Celery flow (returns 202 Accepted)
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    enqueued = enqueue_hint_submission(
        submission_id=submission_id,
        current_user=current_user,
        db=db,
        help_level="concise_hint",
        request_id=request_id
    )
    return JSONResponse(status_code=status.HTTP_202_ACCEPTED, content=enqueued.model_dump())

@router.post(
    "/tutor/{submission_id}/chat",
    response_model=AIChatResponse,
    summary="Socratic tutor chat turn",
    description="Submits a user follow-up question in the Socratic tutor thread for a specific submission and receives guided feedback.",
    responses={403: _403_response, 404: _404_response, 429: _429_response}
)
def ai_tutor_chat_turn(
    submission_id: int,
    chat_in: AIChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Send a question to the Socratic AI tutor for a specific submission."""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    if submission.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    problem = db.query(Problem).filter(Problem.id == submission.problem_id).first()

    # Load existing history
    history_records = db.query(AITutorConversation).filter(
        AITutorConversation.submission_id == submission_id
    ).order_by(AITutorConversation.created_at.asc()).all()

    chat_history = [{"role": record.role, "content": record.content} for record in history_records]

    # Generate AI reply
    reply_text = generate_tutor_chat_reply(
        problem_title=problem.title if problem else "Problem",
        problem_description=problem.description if problem else "",
        user_code=submission.code,
        verdict=submission.verdict.name if submission.verdict else "FAILED",
        chat_history=chat_history,
        user_message=chat_in.message
    )

    # Record both user message and assistant reply in DB
    db.add(AITutorConversation(
        submission_id=submission_id,
        user_id=current_user.id,
        role="user",
        content=chat_in.message
    ))
    db.add(AITutorConversation(
        submission_id=submission_id,
        user_id=current_user.id,
        role="assistant",
        content=reply_text
    ))
    db.commit()

    return AIChatResponse(reply=reply_text)

@router.get(
    "/tutor/{submission_id}/history",
    response_model=List[AIChatMessage],
    summary="Get Socratic tutor conversation history",
    description="Loads all user and tutor messages exchanged for a specific submission.",
    responses={403: _403_response, 404: _404_response}
)
def get_ai_tutor_history(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Retrieve full Socratic tutor conversation for a submission."""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    if submission.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    records = db.query(AITutorConversation).filter(
        AITutorConversation.submission_id == submission_id
    ).order_by(AITutorConversation.created_at.asc()).all()

    return [AIChatMessage(role=r.role, content=r.content, created_at=r.created_at) for r in records]

@router.post(
    "/complexity/{submission_id}",
    response_model=AIComplexityResponse,
    summary="Analyze code time and space complexity",
    description="Analyzes submitted C++ code for asymptotic time and space complexity, operation breakdown, and performance optimization suggestions.",
    responses={403: _403_response, 404: _404_response, 429: _429_response}
)
def get_complexity_analysis(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Analyze time and space complexity of code with caching."""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    if submission.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Check cache by submission_id
    cached = db.query(AIComplexityAnalysis).filter(AIComplexityAnalysis.submission_id == submission_id).first()
    if not cached:
        # Check cache by code_hash
        code_h = compute_code_hash(submission.code)
        cached = db.query(AIComplexityAnalysis).filter(AIComplexityAnalysis.code_hash == code_h).first()

    if cached:
        ops = json.loads(cached.operations_breakdown) if cached.operations_breakdown else []
        opts = json.loads(cached.optimizations) if cached.optimizations else []
        return AIComplexityResponse(
            time_complexity=cached.time_complexity,
            space_complexity=cached.space_complexity,
            performance=cached.performance,
            explanation=cached.explanation,
            operations_breakdown=[OperationBreakdownItem(**item) for item in ops],
            optimizations=opts
        )

    problem = db.query(Problem).filter(Problem.id == submission.problem_id).first()
    
    # Run analysis via AI service
    result = analyze_complexity(
        user_code=submission.code,
        problem_description=problem.description if problem else ""
    )

    # Save to cache DB
    code_h = compute_code_hash(submission.code)
    db_analysis = AIComplexityAnalysis(
        submission_id=submission_id,
        code_hash=code_h,
        time_complexity=result.time_complexity,
        space_complexity=result.space_complexity,
        performance=result.performance,
        explanation=result.explanation,
        operations_breakdown=json.dumps([item.model_dump() for item in result.operations_breakdown]),
        optimizations=json.dumps(result.optimizations)
    )
    db.add(db_analysis)
    db.commit()

    return result
