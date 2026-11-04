import docker
from sqlalchemy.orm import Session
import tempfile
import os
import sys
import time
import subprocess
from app.db.models import Submission, Problem, TestCase, VerdictEnum
from app.db.database import SessionLocal

# Initialize docker client safely
try:
    client = docker.from_env()
except Exception as e:
    client = None
    print(f"Warning: Docker client could not be initialized. Error: {e}")

def is_docker_available() -> bool:
    """Check if the Docker daemon is actively responding."""
    if not client:
        return False
    try:
        client.ping()
        return True
    except Exception:
        return False

def normalize_output(text: str) -> str:
    """Standard CP output normalizer: strip trailing line whitespace and CRLF -> LF."""
    if text is None:
        return ""
    return "\n".join(line.rstrip() for line in text.strip().splitlines())

def judge_submission(submission_id: int, db: Session = None):
    """Judge a submitted solution in Docker sandbox (if available) or local subprocess fallback."""
    own_session = False
    if db is None or not db.is_active:
        db = SessionLocal()
        own_session = True

    try:
        submission = db.query(Submission).filter(Submission.id == submission_id).first()
        if not submission:
            return
        
        submission.verdict = VerdictEnum.RUNNING
        db.commit()

        problem = db.query(Problem).filter(Problem.id == submission.problem_id).first()
        if not problem:
            submission.verdict = VerdictEnum.RE
            db.commit()
            return

        test_cases = db.query(TestCase).filter(TestCase.problem_id == problem.id).all()
        lang = (submission.language or "cpp").lower()

        # If Docker is unavailable or if language is python, use local subprocess runner
        if not is_docker_available() or lang in ["python", "python3", "py"]:
            with tempfile.TemporaryDirectory() as temp_dir:
                if lang in ["python", "python3", "py"]:
                    code_path = os.path.join(temp_dir, "solution.py")
                    with open(code_path, "w", encoding="utf-8") as f:
                        f.write(submission.code)
                    run_cmd = [sys.executable, "-u", "solution.py"]
                else:
                    # C++ compilation
                    code_path = os.path.join(temp_dir, "solution.cpp")
                    with open(code_path, "w", encoding="utf-8") as f:
                        f.write(submission.code)

                    executable_name = "solution.exe" if os.name == "nt" else "solution"
                    compile_cmd = ["g++", "-O2", "solution.cpp", "-o", executable_name]
                    try:
                        res = subprocess.run(
                            compile_cmd,
                            cwd=temp_dir,
                            capture_output=True,
                            timeout=30
                        )
                        if res.returncode != 0:
                            submission.verdict = VerdictEnum.CE
                            db.commit()
                            return
                    except Exception as e:
                        print(f"Local compilation failed: {e}")
                        submission.verdict = VerdictEnum.CE
                        db.commit()
                        return
                    run_cmd = [os.path.join(temp_dir, executable_name)]

                max_time_used = 0.0
                time_limit = float(problem.time_limit or 2.0)

                for tc in test_cases:
                    start_time = time.time()
                    try:
                        res = subprocess.run(
                            run_cmd,
                            input=tc.input_data,
                            capture_output=True,
                            text=True,
                            timeout=time_limit,
                            cwd=temp_dir
                        )
                        exec_time = time.time() - start_time
                        max_time_used = max(max_time_used, exec_time)

                        if res.returncode != 0:
                            submission.verdict = VerdictEnum.RE
                            submission.execution_time = max_time_used
                            db.commit()
                            return
                    except subprocess.TimeoutExpired:
                        submission.verdict = VerdictEnum.TLE
                        submission.execution_time = time_limit
                        db.commit()
                        return
                    except Exception:
                        submission.verdict = VerdictEnum.RE
                        submission.execution_time = max_time_used
                        db.commit()
                        return

                    user_output = normalize_output(res.stdout)
                    expected_output = normalize_output(tc.expected_output)

                    if user_output != expected_output:
                        submission.verdict = VerdictEnum.WA
                        submission.execution_time = max_time_used
                        db.commit()
                        return

                submission.verdict = VerdictEnum.AC
                submission.execution_time = max_time_used
                db.commit()
                return

        # Docker container sandbox for C++
        with tempfile.TemporaryDirectory() as temp_dir:
            code_path = os.path.join(temp_dir, "solution.cpp")
            with open(code_path, "w", encoding="utf-8") as f:
                f.write(submission.code)

            compile_cmd = "g++ -O2 solution.cpp -o solution"
            try:
                client.containers.run(
                    "gcc:latest",
                    command=compile_cmd,
                    volumes={temp_dir: {'bind': '/usr/src/app', 'mode': 'rw'}},
                    working_dir="/usr/src/app",
                    remove=True
                )
            except docker.errors.ContainerError:
                submission.verdict = VerdictEnum.CE
                db.commit()
                return
            except Exception as e:
                submission.verdict = VerdictEnum.RE
                db.commit()
                return

            max_time_used = 0.0
            time_limit = float(problem.time_limit or 2.0)

            for tc in test_cases:
                input_path = os.path.join(temp_dir, "input.txt")
                output_path = os.path.join(temp_dir, "output.txt")
                with open(input_path, "w", encoding="utf-8") as f:
                    f.write(tc.input_data)

                run_cmd = f"bash -c 'timeout {time_limit}s ./solution < input.txt > output.txt'"
                start_time = time.time()
                try:
                    mem_limit_bytes = int(problem.memory_limit or 256) * 1024 * 1024
                    client.containers.run(
                        "gcc:latest",
                        command=run_cmd,
                        volumes={temp_dir: {'bind': '/usr/src/app', 'mode': 'rw'}},
                        working_dir="/usr/src/app",
                        mem_limit=mem_limit_bytes,
                        memswap_limit=mem_limit_bytes,
                        network_disabled=True,
                        remove=True
                    )
                except docker.errors.ContainerError as e:
                    if e.exit_status == 124:
                        submission.verdict = VerdictEnum.TLE
                    else:
                        submission.verdict = VerdictEnum.RE
                    db.commit()
                    return
                except Exception:
                    submission.verdict = VerdictEnum.RE
                    db.commit()
                    return

                exec_time = time.time() - start_time
                max_time_used = max(max_time_used, exec_time)

                user_raw = ""
                if os.path.exists(output_path):
                    with open(output_path, "r", encoding="utf-8", errors="replace") as f:
                        user_raw = f.read()

                user_output = normalize_output(user_raw)
                expected_output = normalize_output(tc.expected_output)

                if user_output != expected_output:
                    submission.verdict = VerdictEnum.WA
                    submission.execution_time = max_time_used
                    db.commit()
                    return

            submission.verdict = VerdictEnum.AC
            submission.execution_time = max_time_used
            db.commit()
            return
    finally:
        if own_session:
            db.close()


def run_code(
    code: str,
    language: str = "cpp",
    test_cases: list = None,
    time_limit: float = 2.0
) -> dict:
    """
    Lightweight, synchronous execution of code against sample or custom test cases.
    Returns per-testcase execution details and error logs if any.
    """
    if not test_cases:
        test_cases = [{"input": "", "expected": ""}]

    lang = (language or "cpp").lower()
    with tempfile.TemporaryDirectory() as temp_dir:
        # 1. Setup & compile if needed
        if lang in ["python", "python3", "py"]:
            code_path = os.path.join(temp_dir, "solution.py")
            with open(code_path, "w", encoding="utf-8") as f:
                f.write(code)
            run_cmd = [sys.executable, "-u", "solution.py"]
        elif lang in ["cpp", "c++"]:
            code_path = os.path.join(temp_dir, "solution.cpp")
            with open(code_path, "w", encoding="utf-8") as f:
                f.write(code)

            executable_name = "solution.exe" if os.name == "nt" else "solution"
            executable_path = os.path.join(temp_dir, executable_name)
            compile_cmd = ["g++", "-O2", "solution.cpp", "-o", executable_name]

            try:
                comp = subprocess.run(
                    compile_cmd,
                    cwd=temp_dir,
                    capture_output=True,
                    timeout=20
                )
                if comp.returncode != 0:
                    err_msg = comp.stderr.decode("utf-8", errors="replace")
                    return {
                        "status": "Compilation Error",
                        "results": [],
                        "error": err_msg.strip() or "Compilation failed."
                    }
            except subprocess.TimeoutExpired:
                return {
                    "status": "Compilation Error",
                    "results": [],
                    "error": "Compilation timed out after 20 seconds."
                }
            except Exception as e:
                return {
                    "status": "Compilation Error",
                    "results": [],
                    "error": f"Failed to invoke compiler (g++): {str(e)}"
                }
            run_cmd = [executable_path]
        else:
            return {
                "status": "Runtime Error",
                "results": [],
                "error": f"Unsupported language: '{language}'. Supported: C++, Python."
            }

        # 2. Run against each test case
        results = []
        overall_status = "Accepted"

        for tc in test_cases:
            inp = tc.get("input", "")
            exp = tc.get("expected", "")
            start_t = time.time()

            try:
                res = subprocess.run(
                    run_cmd,
                    input=inp,
                    capture_output=True,
                    text=True,
                    timeout=time_limit,
                    cwd=temp_dir
                )
                elapsed_ms = max(1, int((time.time() - start_t) * 1000))

                if res.returncode != 0:
                    err_text = res.stderr.strip()
                    results.append({
                        "input": inp,
                        "expected": exp,
                        "actual": err_text or f"Process exited with non-zero code {res.returncode}",
                        "passed": False,
                        "runtime": elapsed_ms
                    })
                    if overall_status == "Accepted":
                        overall_status = "Runtime Error"
                else:
                    actual_out = res.stdout
                    norm_actual = normalize_output(actual_out)
                    norm_expected = normalize_output(exp)

                    # If expected is given, compare; if custom input mode with empty expected, consider passed
                    passed = (norm_actual == norm_expected) if exp != "" else True
                    results.append({
                        "input": inp,
                        "expected": exp,
                        "actual": actual_out.strip(),
                        "passed": passed,
                        "runtime": elapsed_ms
                    })
                    if not passed and overall_status == "Accepted":
                        overall_status = "Wrong Answer"

            except subprocess.TimeoutExpired:
                results.append({
                    "input": inp,
                    "expected": exp,
                    "actual": "Time Limit Exceeded",
                    "passed": False,
                    "runtime": int(time_limit * 1000)
                })
                if overall_status == "Accepted":
                    overall_status = "Time Limit Exceeded"
            except Exception as e:
                results.append({
                    "input": inp,
                    "expected": exp,
                    "actual": f"Execution error: {str(e)}",
                    "passed": False,
                    "runtime": 0
                })
                if overall_status == "Accepted":
                    overall_status = "Runtime Error"

        return {
            "status": overall_status,
            "results": results,
            "error": None
        }
