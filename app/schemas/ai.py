from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from app.services.ai import (
    AITutorHintResponse,
    AIComplexityResponse,
    AIGeneratedProblemSchema,
    OperationBreakdownItem
)

class AIChatMessage(BaseModel):
    role: str
    content: str
    created_at: Optional[datetime] = None

class AIChatRequest(BaseModel):
    message: str

class AIChatResponse(BaseModel):
    reply: str

class AIProblemGenerateRequest(BaseModel):
    topic: str
    difficulty: str = "Medium"
    tags: Optional[str] = ""
    instructions: Optional[str] = ""

class TestValidationRequest(BaseModel):
    problem_id: Optional[int] = None
    cpp_solution: str
    test_cases: List[dict] # list of {"input_data": "...", "expected_output": "..."}

class TestValidationResultItem(BaseModel):
    index: int
    input_data: str
    expected_output: str
    actual_output: str
    status: str # "MATCH" or "MISMATCH" or "ERROR"

class TestValidationResponse(BaseModel):
    total: int
    matched: int
    mismatched: int
    results: List[TestValidationResultItem]
