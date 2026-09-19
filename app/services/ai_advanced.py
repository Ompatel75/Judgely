import json
from typing import List, Optional
from pydantic import BaseModel, Field
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from app.services.ai import get_llm, extract_response_text
from app.schemas.ai_advanced import (
    CodeReviewSchema, HintResponse, PracticePlanResponse, InterviewEvaluationResponse
)

# 1. AI Code Review
def generate_code_review(problem_title: str, problem_description: str, user_code: str) -> CodeReviewSchema:
    llm = get_llm()
    if not llm:
        raise ValueError("LLM not configured.")
    
    parser = JsonOutputParser(pydantic_object=CodeReviewSchema)
    prompt = PromptTemplate(
        template="""You are an expert Software Engineer at a top MNC conducting a Code Review.
Analyze the following code for a problem called '{problem_title}'.

Problem Description:
{problem_description}

User Code:
{user_code}

Evaluate the code strictly on these criteria:
1. Correctness
2. Time Complexity
3. Space Complexity
4. Code Quality (Readability, Naming conventions)
5. MNC Quality Standards (SOLID principles, DRY, modularity, defensive programming)
6. Potential Bugs
7. Edge Cases
8. Unnecessary Operations
9. Optimizations
10. Maintainability

{format_instructions}""",
        input_variables=["problem_title", "problem_description", "user_code"],
        partial_variables={"format_instructions": parser.get_format_instructions()},
    )
    chain = prompt | llm | parser
    response = chain.invoke({
        "problem_title": problem_title,
        "problem_description": problem_description,
        "user_code": user_code
    })
    return CodeReviewSchema(**response)

# 2. Progressive AI Hints
def generate_progressive_hints(problem_title: str, problem_description: str) -> dict:
    llm = get_llm()
    if not llm:
        raise ValueError("LLM not configured.")
    
    prompt = PromptTemplate(
        template="""You are a helpful DSA tutor. Generate progressive hints for '{problem_title}'.
Problem: {problem_description}

Return ONLY valid JSON in this format:
{{
  "hint_1": "Small conceptual hint",
  "hint_2": "More specific direction",
  "hint_3": "Data structure/algorithm hint",
  "approach": "Detailed approach without code",
  "solution": "Complete explanation"
}}
""",
        input_variables=["problem_title", "problem_description"]
    )
    chain = prompt | llm
    response = chain.invoke({
        "problem_title": problem_title,
        "problem_description": problem_description
    })
    text = extract_response_text(response.content)
    text = text.replace("```json", "").replace("```", "").strip()
    return json.loads(text)

# 3. Personalized Practice Plan
def generate_practice_plan(stats_json: str) -> str:
    llm = get_llm()
    if not llm:
        raise ValueError("LLM not configured.")
    
    prompt = PromptTemplate(
        template="""You are a DSA Coach. Given the user's historical performance, generate a 7-day personalized practice roadmap.
User Stats: {stats}

Format the output nicely in Markdown.
Focus on weak topics and gradually increase difficulty.
""",
        input_variables=["stats"]
    )
    chain = prompt | llm
    response = chain.invoke({"stats": stats_json})
    return extract_response_text(response.content)

# 4. AI Mock Interview Evaluation
def evaluate_mock_interview(transcript: str) -> InterviewEvaluationResponse:
    llm = get_llm()
    if not llm:
        raise ValueError("LLM not configured.")
    
    parser = JsonOutputParser(pydantic_object=InterviewEvaluationResponse)
    prompt = PromptTemplate(
        template="""You are a Senior Engineering Manager at a top tech company. Evaluate the following Mock Interview transcript.

Transcript:
{transcript}

Grade the candidate out of 10 for: problem_solving, dsa, complexity, code_quality, communication, edge_case.
Also provide text summaries for strengths, weaknesses, mistakes, recommended_topics, and an improvement_plan.

{format_instructions}""",
        input_variables=["transcript"],
        partial_variables={"format_instructions": parser.get_format_instructions()}
    )
    chain = prompt | llm | parser
    response = chain.invoke({"transcript": transcript})
    return InterviewEvaluationResponse(**response)

def generate_interview_chat_reply(topic: str, difficulty: str, transcript: str) -> str:
    llm = get_llm()
    if not llm:
        raise ValueError("LLM not configured.")
    
    prompt = PromptTemplate(
        template="""You are a Technical Interviewer conducting a {difficulty} coding interview on {topic}.
Here is the transcript so far:
{transcript}

Respond as the interviewer. Ask follow up questions, probe for complexity, ask about edge cases, or ask them to code. Keep it brief and conversational, just like a real interview. DO NOT give them the answer.
Interviewer:""",
        input_variables=["difficulty", "topic", "transcript"]
    )
    chain = prompt | llm
    response = chain.invoke({"difficulty": difficulty, "topic": topic, "transcript": transcript})
    return extract_response_text(response.content)
