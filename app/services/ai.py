import json
import hashlib
from typing import List, Optional
from pydantic import BaseModel, Field
from app.core.config import settings

class AITutorHintResponse(BaseModel):
    what_went_wrong: str = Field(description="Short, clear explanation of what likely went wrong in simple terms.")
    hint_1: str = Field(description="Light hint pointing to the general logic or setup.")
    hint_2: str = Field(description="More specific hint pointing toward the problematic logic or data structure.")
    strong_hint: str = Field(description="Direct guidance on what assumption or edge case is failing, without rewriting full solution.")
    edge_case: str = Field(description="Specific test case or edge condition to think about.")
    where_to_look: str = Field(description="Line number range or function to inspect.")
    concept: str = Field(description="Core algorithm or C++ language concept involved.")
    confidence: str = Field(description="Confidence rating: High, Medium, or Low.")

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

def get_llm():
    if not settings.GEMINI_API_KEY or settings.GEMINI_API_KEY.startswith("your_"):
        return None
    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
        llm = ChatGoogleGenerativeAI(
            model=settings.AI_MODEL,
            google_api_key=settings.GEMINI_API_KEY,
            temperature=0.3
        )
        return llm
    except Exception as e:
        print(f"Error initializing LangChain Google GenAI: {e}")
        return None

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

# Feature 1: AI Code Tutor & Debugger
def generate_tutor_hint(
    problem_title: str,
    problem_description: str,
    user_code: str,
    verdict: str
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
    
    from langchain_core.prompts import ChatPromptTemplate
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are an expert Socratic competitive programming tutor.
Your goal is to guide the student to discover their bug without writing the complete solution code for them.

RULES:
1. Do NOT rewrite the complete corrected C++ code.
2. Explain the mistake simply and directly in plain, friendly language.
3. Provide progressive hints (Hint 1 = broad direction, Hint 2 = logic focus, Strong Hint = targeted clue).
4. Highlight possible integer overflows, off-by-one errors, or wrong constraints.
5. Identify specific edge cases.
"""),
        ("user", """
PROBLEM TITLE: {title}
PROBLEM DESCRIPTION:
{description}

STUDENT SUBMITTED CODE (C++):
```cpp
{code}
```

VERDICT RECEIVED: {verdict}

Analyze this submission and provide your Socratic tutoring feedback according to the requested format.
""")
    ])
    
    try:
        structured_llm = llm.with_structured_output(AITutorHintResponse)
        chain = prompt | structured_llm
        result = chain.invoke({
            "title": problem_title,
            "description": problem_description,
            "code": user_code,
            "verdict": verdict
        })
        return result
    except Exception as e:
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
            ]
        )

    from langchain_core.prompts import ChatPromptTemplate

    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are a master Competitive Programming Problem Setter (like Codeforces / LeetCode author).
Generate a complete, contest-ready programming problem along with verified test cases.

Make sure:
1. Markdown description is clear, professional, with Task, Input Format, Output Format, Constraints, and Examples.
2. Generate 1-2 Sample Test Cases (is_hidden=False) and 3-5 Hidden Test Cases (is_hidden=True) covering boundary and edge cases.
3. Test inputs and expected outputs MUST be strictly matching and accurate!
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
