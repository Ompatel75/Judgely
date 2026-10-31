from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class TestCaseBase(BaseModel):
    input_data: str
    expected_output: str
    is_hidden: bool = True

class TestCaseCreate(TestCaseBase):
    pass

class TestCaseResponse(TestCaseBase):
    id: int
    problem_id: int

    class Config:
        from_attributes = True

class ProblemBase(BaseModel):
    title: str
    description: str
    time_limit: float = 1.0
    memory_limit: int = 256
    tags: Optional[str] = ""

class ProblemCreate(ProblemBase):
    hint_1: Optional[str] = None
    hint_2: Optional[str] = None
    hint_3: Optional[str] = None
    approach: Optional[str] = None
    solution: Optional[str] = None

class ProblemResponse(ProblemBase):
    id: int
    created_at: datetime
    test_cases: List[TestCaseResponse] = []

    class Config:
        from_attributes = True
