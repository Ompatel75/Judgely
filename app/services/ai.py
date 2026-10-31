import json
import hashlib
import time
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from app.core.config import settings

class AITutorHintResponse(BaseModel):
    what_went_wrong: str = Field(default="Analysis complete.", description="Short, clear explanation of what likely went wrong in simple terms.")
    hint_1: str = Field(default="Review your code logic.", description="Light hint pointing to the general logic or setup.")
    hint_2: str = Field(default="Check loop boundaries and constraints.", description="More specific hint pointing toward the problematic logic or data structure.")
    strong_hint: str = Field(default="Inspect edge case inputs and boundary conditions.", description="Direct guidance on what assumption or edge case is failing, without rewriting full solution.")
    edge_case: str = Field(default="Boundary conditions (N=0, N=1, extreme values)", description="Specific test case or edge condition to think about.")
    where_to_look: str = Field(default="Main solution block", description="Line number range or function to inspect.")
    concept: str = Field(default="Algorithm logic", description="Core algorithm or C++ language concept involved.")
    confidence: str = Field(default="Medium", description="Confidence rating: High, Medium, or Low.")

class OperationBreakdownItem(BaseModel):
    operation: str = Field(description="The code operation or function, e.g. sort(), for loop, unordered_map lookup")
    complexity: str = Field(description="Complexity of this operation, e.g. O(N log N)")
    line_reference: Optional[str] = Field(default="", description="Relevant line numbers or function name")

class AIComplexityResponse(BaseModel):
    time_complexity: str = Field(description="Big-O Time Complexity, e.g. O(N log N)")
    space_complexity: str = Field(description="Big-O Auxiliary Space Complexity, e.g. O(N)")
    performance: str = Field(description="Performance rating: Excellent, Good, Average, Needs Improvement")
    explanation: str = Field(description="Detailed narrative explaining WHY this complexity was derived.")
    operations_breakdown: List[OperationBreakdownItem] = Field(description="Breakdown of key operations in the code.")
    optimizations: List[str] = Field(description="List of suggestions to improve runtime, memory, or readability.")

class AITestCaseItem(BaseModel):
    input_data: str = Field(description="Standard input data for the test case.")
    expected_output: str = Field(description="Expected standard output data.")
    is_hidden: bool = Field(default=True, description="True if hidden testcase, False if sample testcase.")
    description: Optional[str] = Field(default="", description="Category: Sample, Edge Case, Corner Case, Stress Test")

class AIGeneratedProblemSchema(BaseModel):
    title: str = Field(description="Concise, creative problem title.")
    description: str = Field(description="Full problem description in GitHub Markdown, including Task, Input Format, Output Format, Constraints, and Sample Examples.")
    time_limit: float = Field(default=1.0, description="Time limit in seconds (usually 0.5 - 2.0).")
    memory_limit: int = Field(default=256, description="Memory limit in MB (usually 256 or 512).")
    tags: str = Field(description="Comma separated tags e.g. binary-search, arrays, math")
    test_cases: List[AITestCaseItem] = Field(description="List of sample and hidden testcases.")
    hint_1: Optional[str] = Field(default="", description="Small conceptual hint pointing in the right direction.")
    hint_2: Optional[str] = Field(default="", description="Algorithmic hint pointing toward key logic or data structure.")
    hint_3: Optional[str] = Field(default="", description="Observation hint highlighting constraints or edge cases.")
    approach: Optional[str] = Field(default="", description="High level approach to solve the problem.")
    solution: Optional[str] = Field(default="", description="Complete explanation of optimal solution.")

_llm_client = None

def init_ai_client():
    """Initializes a single reusable Gemini client at startup."""
    global _llm_client
    if not settings.GEMINI_API_KEY or settings.GEMINI_API_KEY.startswith("your_"):
        _llm_client = None
        return None
    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
        kwargs = {
            "model": settings.AI_MODEL,
            "google_api_key": settings.GEMINI_API_KEY,
            "temperature": settings.AI_TEMPERATURE,
            "max_output_tokens": settings.AI_MAX_OUTPUT_TOKENS,
            "timeout": settings.AI_REQUEST_TIMEOUT,
            "max_retries": 1,
        }
        if hasattr(settings, "AI_THINKING_BUDGET") and settings.AI_THINKING_BUDGET >= 0:
            kwargs["thinking_budget"] = settings.AI_THINKING_BUDGET
        _llm_client = ChatGoogleGenerativeAI(**kwargs)
        return _llm_client
    except Exception as e:
        print(f"Error initializing LangChain Google GenAI client: {e}")
        _llm_client = None
        return None

def get_llm():
    """Returns the shared reusable LLM client, initializing if needed."""
    global _llm_client
    if _llm_client is None:
        init_ai_client()
    return _llm_client

def extract_response_text(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict) and "text" in item:
                parts.append(item["text"])
        return "\n".join(parts)
    return str(content)

def compute_code_hash(code: str) -> str:
    return hashlib.sha256(code.strip().encode("utf-8")).hexdigest()

def get_trimmed_tutor_prompt():
    """Builds a token-efficient, trimmed prompt containing only the problem, code, verdict, and requested help level."""
    from langchain_core.prompts import ChatPromptTemplate
    return ChatPromptTemplate.from_messages([
        ("system", """You are a focused Socratic competitive programming tutor.
Guide the student to uncover their bug without revealing the complete solution.
Be concise and direct. Keep hints actionable and short.
Follow the requested help level strictly."""),
        ("user", """PROBLEM: {title}
{description}

CODE:
```cpp
{code}
```

VERDICT: {verdict}
HELP LEVEL: {help_level}
""")
    ])

# Feature 1: AI Code Tutor & Debugger
def generate_tutor_hint(
    problem_title: str,
    problem_description: str,
    user_code: str,
    verdict: str,
    help_level: str = "hint",
    request_id: Optional[str] = None,
    timing_collector: Optional[Dict[str, Any]] = None
) -> AITutorHintResponse:
    llm = get_llm()
    if not llm:
        return AITutorHintResponse(
            what_went_wrong="AI API Key not configured on the server. Please set GEMINI_API_KEY in .env.",
            hint_1="Review your code logic manually against sample inputs.",
            hint_2="Check loop boundaries and array bounds.",
            strong_hint="Inspect variable data types (e.g., int vs long long).",
            edge_case="Test with N = 1, N = 0, or maximum allowed constraint values.",
            where_to_look="Main logic function / loops.",
            concept="Data Types & Edge Cases",
            confidence="Low"
        )
    
    t_prompt_start = time.perf_counter()
    prompt = get_trimmed_tutor_prompt()
    if timing_collector is not None:
        timing_collector["prompt_build_ms"] = (time.perf_counter() - t_prompt_start) * 1000
    
    try:
        t_gemini_start = time.perf_counter()
        structured_llm = llm.with_structured_output(AITutorHintResponse)
        chain = prompt | structured_llm
        result = chain.invoke({
            "title": problem_title,
            "description": problem_description,
            "code": user_code,
            "verdict": verdict,
            "help_level": help_level
        })
        if timing_collector is not None:
            timing_collector["gemini_call_ms"] = (time.perf_counter() - t_gemini_start) * 1000
        return result
    except Exception as e:
        if timing_collector is not None and "gemini_call_ms" not in timing_collector:
            timing_collector["gemini_call_ms"] = (time.perf_counter() - t_gemini_start) * 1000
        print(f"Error in generate_tutor_hint: {e}")
        return AITutorHintResponse(
            what_went_wrong=f"AI analysis encountered an issue: {str(e)}",
            hint_1="Review your logic step-by-step.",
            hint_2="Test with small inputs locally.",
            strong_hint="Check variable scope and initialization.",
            edge_case="Boundary conditions",
            where_to_look="Main solution block",
            concept="Debugging",
            confidence="Low"
        )

async def async_generate_tutor_hint(
    problem_title: str,
    problem_description: str,
    user_code: str,
    verdict: str,
    help_level: str = "hint",
    request_id: Optional[str] = None,
    timing_collector: Optional[Dict[str, Any]] = None
) -> AITutorHintResponse:
    import asyncio
    return await asyncio.to_thread(
        generate_tutor_hint,
        problem_title=problem_title,
        problem_description=problem_description,
        user_code=user_code,
        verdict=verdict,
        help_level=help_level,
        request_id=request_id,
        timing_collector=timing_collector
    )

async def stream_tutor_hint(
    problem_title: str,
    problem_description: str,
    user_code: str,
    verdict: str,
    help_level: str = "hint"
):
    """Streams Socratic AI hint tokens asynchronously as they arrive."""
    import asyncio
    import logging
    log = logging.getLogger("ai_stream")
    
    llm = get_llm()
    if not llm:
        fallback_msg = (
            "**Diagnosed Error:** AI API key is not configured on the server.\n\n"
            "**Hint 1:** Review your code logic against sample test cases.\n\n"
            "**Hint 2:** Check loop limits, boundary conditions, and variable types."
        )
        for word in fallback_msg.split(" "):
            yield word + " "
            await asyncio.sleep(0.02)
        return

    prompt = get_trimmed_tutor_prompt()
    chain = prompt | llm

    try:
        async for chunk in chain.astream({
            "title": problem_title,
            "description": problem_description,
            "code": user_code,
            "verdict": verdict,
            "help_level": help_level
        }):
            content = chunk.content
            if isinstance(content, str) and content:
                yield content
            elif isinstance(content, list):
                for item in content:
                    if isinstance(item, str) and item:
                        yield item
                    elif isinstance(item, dict) and "text" in item:
                        yield item["text"]
    except Exception as e:
        log.warning("LLM streaming encountered exception (%s). Emitting structured guidance fallback.", e)
        fallback_text = (
            f"**Diagnosed Error:** Code received {verdict} verdict. Review state variables and edge cases.\n\n"
            "**Hint 1:** Inspect the loop terminating conditions and index bounds.\n\n"
            "**Hint 2:** Test with minimum and maximum allowed constraints.\n\n"
            "**Concept:** Bounds Checking & Logic Flow"
        )
        for word in fallback_text.split(" "):
            yield word + " "
            await asyncio.sleep(0.01)

# Feature 1: Follow-up Chat
def generate_tutor_chat_reply(
    problem_title: str,
    problem_description: str,
    user_code: str,
    verdict: str,
    chat_history: List[dict],
    user_message: str
) -> str:
    llm = get_llm()
    if not llm:
        return "AI service is currently unavailable. Please configure GEMINI_API_KEY."

    from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

    messages = [
        SystemMessage(content=f"""You are a friendly, expert C++ competitive programming tutor.
The user is working on: '{problem_title}'. Verdict: {verdict}.
User Code:
```cpp
{user_code}
```

GUIDELINES:
1. Be concise, clear, and direct. Avoid overwhelming textbook dumps.
2. Give actionable hints or brief explanations.
3. Keep code snippets short and focused.""")
    ]

    for turn in chat_history:
        if turn.get("role") == "user":
            messages.append(HumanMessage(content=turn.get("content", "")))
        elif turn.get("role") == "assistant":
            messages.append(AIMessage(content=turn.get("content", "")))

    messages.append(HumanMessage(content=user_message))

    try:
        response = llm.invoke(messages)
        return extract_response_text(response.content)
    except Exception as e:
        return f"Sorry, I couldn't process your question right now: {str(e)}"

# Feature: Persistent General & Problem-Context AI Assistant
def generate_general_chat_reply(
    message: str,
    problem_title: Optional[str] = None,
    problem_description: Optional[str] = None,
    current_code: Optional[str] = None,
    history: Optional[List[dict]] = None
) -> str:
    llm = get_llm()
    if not llm:
        return "AI Assistant is running in fallback mode. Please configure GEMINI_API_KEY in .env."

    from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

    sys_text = """You are Judgely AI, a friendly, expert C++ competitive programming mentor.

CRITICAL COMMUNICATION RULES:
1. Speak in clean, natural, human-friendly language.
2. Be CONCISE and to the point. Do NOT output giant textbook tutorials or long repetitive essays unless explicitly asked for a full tutorial.
3. Format your answers clearly with short paragraphs, simple bullet points, and concise code snippets.
4. Answer the user's exact question directly."""

    if problem_title:
        sys_text += f"\n\nCurrent Problem Context: '{problem_title}'"
        if problem_description:
            sys_text += f"\nDescription Summary: {problem_description[:500]}..."
    if current_code and current_code.strip():
        sys_text += f"\nCurrent User Code:\n```cpp\n{current_code}\n```"

    messages = [SystemMessage(content=sys_text)]

    if history:
        for turn in history:
            role = turn.get("role")
            content = turn.get("content", "")
            if role == "user":
                messages.append(HumanMessage(content=content))
            elif role == "assistant":
                messages.append(AIMessage(content=content))

    messages.append(HumanMessage(content=message))

    try:
        response = llm.invoke(messages)
        return extract_response_text(response.content)
    except Exception as e:
        return f"Error connecting to AI assistant: {str(e)}"

# Feature 2: Time & Space Complexity Analyzer
def analyze_complexity(user_code: str, problem_description: str) -> AIComplexityResponse:
    llm = get_llm()
    if not llm:
        return AIComplexityResponse(
            time_complexity="O(N)",
            space_complexity="O(1)",
            performance="Good",
            explanation="AI key not configured. Default static estimation provided.",
            operations_breakdown=[OperationBreakdownItem(operation="Linear execution", complexity="O(N)", line_reference="main")],
            optimizations=["Ensure fast I/O is enabled using cin.tie(NULL)."]
        )

    from langchain_core.prompts import ChatPromptTemplate

    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are an expert algorithm analysis engine.
Analyze the provided C++ solution for Time Complexity and Auxiliary Space Complexity.

Determine:
1. Time Complexity in Big-O notation (e.g. O(N log N)).
2. Space Complexity in Big-O notation (e.g. O(N)).
3. Overall Performance Rating (Excellent, Good, Average, Needs Improvement).
4. Detailed explanation of dominant operations.
5. Itemized operations breakdown table.
6. Actionable optimization suggestions.
"""),
        ("user", """
PROBLEM DESCRIPTION:
{description}

C++ SOLUTION CODE:
```cpp
{code}
```
""")
    ])

    try:
        structured_llm = llm.with_structured_output(AIComplexityResponse)
        chain = prompt | structured_llm
        result = chain.invoke({
            "description": problem_description,
            "code": user_code
        })
        return result
    except Exception as e:
        print(f"Error in analyze_complexity: {e}")
        return AIComplexityResponse(
            time_complexity="O(N)",
            space_complexity="O(1)",
            performance="Good",
            explanation=f"Analysis completed with fallback due to API status: {str(e)}",
            operations_breakdown=[],
            optimizations=[]
        )

# Feature 3: AI Problem & Test Case Generator
def generate_problem_with_ai(
    topic: str,
    difficulty: str,
    tags: str,
    instructions: str = ""
) -> AIGeneratedProblemSchema:
    llm = get_llm()
    if not llm:
        return AIGeneratedProblemSchema(
            title=f"Sample AI Problem: {topic.title()}",
            description=f"## {topic.title()} Challenge\n\nGiven an array of integers, solve this {difficulty} problem using **{topic}**.\n\n### Task\nFind the required target value.\n\n### Input Format\nFirst line contains integer N.\nSecond line contains N space-separated integers.\n\n### Output Format\nPrint a single integer result.\n\n### Constraints\n1 <= N <= 10^5",
            time_limit=1.0,
            memory_limit=256,
            tags=tags or topic,
            test_cases=[
                AITestCaseItem(input_data="5\n1 2 3 4 5\n", expected_output="15", is_hidden=False, description="Sample 1"),
                AITestCaseItem(input_data="1\n100\n", expected_output="100", is_hidden=True, description="Edge Case N=1"),
                AITestCaseItem(input_data="3\n-5 0 5\n", expected_output="0", is_hidden=True, description="Negative numbers")
            ],
            hint_1="Think about how the elements relate to each other.",
            hint_2="Can a hash map or sorting simplify the search?",
            hint_3="Be careful with edge cases when array size is small.",
            approach="Iterate through the array and accumulate values or check pairs.",
            solution="A linear single pass with an auxiliary structure yields optimal O(N) time."
        )

    from langchain_core.prompts import ChatPromptTemplate

    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are a master Competitive Programming Problem Setter (like Codeforces / LeetCode author).
Generate a complete, contest-ready programming problem along with verified test cases and progressive hints.

Make sure:
1. Markdown description is clear, professional, with Task, Input Format, Output Format, Constraints, and Examples.
2. Generate 1-2 Sample Test Cases (is_hidden=False) and 3-5 Hidden Test Cases (is_hidden=True) covering boundary and edge cases.
3. Test inputs and expected outputs MUST be strictly matching and accurate!
4. Provide progressive hints (hint_1, hint_2, hint_3), high-level approach, and solution explanation so they can be stored with the problem.
"""),
        ("user", """
Generate a competitive programming problem with the following requirements:
- TOPIC: {topic}
- DIFFICULTY: {difficulty}
- TAGS: {tags}
- ADDITIONAL INSTRUCTIONS: {instructions}
""")
    ])

    try:
        structured_llm = llm.with_structured_output(AIGeneratedProblemSchema)
        chain = prompt | structured_llm
        result = chain.invoke({
            "topic": topic,
            "difficulty": difficulty,
            "tags": tags,
            "instructions": instructions or "Make it clear and contest ready."
        })
        return result
    except Exception as e:
        print(f"Error in generate_problem_with_ai: {e}")
        raise RuntimeError(f"AI Problem Generation failed: {str(e)}")
