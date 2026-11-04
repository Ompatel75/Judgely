from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.db.models import VerdictEnum

class SubmissionBase(BaseModel):
    problem_id: int
    code: str
    language: str = "cpp"

class SubmissionCreate(SubmissionBase):
    pass

class SubmissionResponse(SubmissionBase):
    id: int
    user_id: int
    verdict: VerdictEnum
    execution_time: Optional[float] = None
    memory_used: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Lightweight Test / Sample Run Schemas
class TestCaseRunInput(BaseModel):
    input: str
    expected: Optional[str] = ""

class CodeRunRequest(BaseModel):
    problem_id: Optional[int] = None
    language: str = "cpp"
    code: str
    custom_input: Optional[str] = None
    test_cases: Optional[List[TestCaseRunInput]] = None

class TestCaseRunResult(BaseModel):
    input: str
    expected: str
    actual: str
    passed: bool
    runtime: Optional[int] = None

class CodeRunResponse(BaseModel):
    status: str # "Accepted", "Wrong Answer", "Runtime Error", "Compilation Error", "Time Limit Exceeded"
    results: List[TestCaseRunResult] = []
    error: Optional[str] = None
