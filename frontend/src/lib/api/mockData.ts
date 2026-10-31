import type { Problem, Submission, User, UserStats } from './types'

export const MOCK_USER: User = {
  id: 1,
  username: 'alex_chen',
  email: 'alex@judgely.dev',
  created_at: '2026-01-15T00:00:00Z',
  solved_count: 84,
  ranking: 142,
  streak_days: 12,
}

export const MOCK_PROBLEMS: Problem[] = [
  {
    id: 1,
    title: 'Two Sum II - Sorted Array',
    slug: 'two-sum-ii-sorted-array',
    difficulty: 'Easy',
    time_limit: 1.0,
    memory_limit: 256,
    acceptance_rate: 61.2,
    total_submissions: 14250,
    total_accepted: 8721,
    status: 'solved',
    tags: ['Two Pointers', 'Binary Search', 'Array'],
    description: `Given a **1-indexed** array of integers \`numbers\` that is already sorted in non-decreasing order, find two numbers such that they add up to a specific \`target\` number.

Let these two numbers be \`numbers[index1]\` and \`numbers[index2]\` where $1 \\le \\text{index1} < \\text{index2} \\le n$.

Return the indices of the two numbers, $\\text{index1}$ and $\\text{index2}$, added by one as an integer array $[\\text{index1}, \\text{index2}]$ of length 2.

The tests are generated such that there is **exactly one solution**. You may not use the same element twice. Your solution must use only $\\mathcal{O}(1)$ additional space.`,
    input_format: `The first line contains an integer $n$ ($2 \\le n \\le 10^5$), the size of the array.
The second line contains $n$ space-separated integers $a_1, a_2, \\dots, a_n$ ($-10^9 \\le a_i \\le 10^9$).
The third line contains an integer $T$ ($-2 \\cdot 10^9 \\le T \\le 2 \\cdot 10^9$), the target sum.`,
    output_format: `Print two space-separated integers: the 1-based indices $\\text{index1}$ and $\\text{index2}$.`,
    constraints: `- $2 \\le n \\le 10^5$
- $-10^9 \\le \\text{numbers}[i] \\le 10^9$
- $\\text{numbers}$ is sorted in **non-decreasing** order
- $-2 \\cdot 10^9 \\le \\text{target} \\le 2 \\cdot 10^9$
- Exactly one valid solution exists`,
    test_cases: [
      {
        id: 1,
        input: '4\n2 7 11 15\n9',
        output: '1 2',
        is_sample: true,
        explanation: 'The sum of 2 and 7 is 9. Therefore, index1 = 1, index2 = 2.',
      },
      {
        id: 2,
        input: '3\n2 3 4\n6',
        output: '1 3',
        is_sample: true,
        explanation: 'The sum of 2 and 4 is 6. Therefore, index1 = 1, index2 = 3.',
      },
      {
        id: 3,
        input: '2\n-1 0\n-1',
        output: '1 2',
        is_sample: true,
        explanation: 'The sum of -1 and 0 is -1. Therefore, index1 = 1, index2 = 2.',
      },
    ],
  },
  {
    id: 2,
    title: 'Range Sum Query - Fenwick Tree',
    slug: 'range-sum-query-fenwick-tree',
    difficulty: 'Medium',
    time_limit: 1.5,
    memory_limit: 256,
    acceptance_rate: 44.8,
    total_submissions: 9810,
    total_accepted: 4395,
    status: 'attempted',
    tags: ['Binary Indexed Tree', 'Segment Tree', 'Data Structures'],
    description: `You are given an integer array $A$ of length $N$. You need to handle $Q$ queries of two types:

1. **Update**: \`1 i x\` — Add value $x$ to element $A[i]$ (i.e. $A[i] \\leftarrow A[i] + x$).
2. **Range Sum**: \`2 l r\` — Compute the sum $\\sum_{k=l}^{r} A[k]$.

Both $i$ and $[l, r]$ are given in **1-indexed** notation. Because the sum can exceed $2^{31} - 1$, compute answers using 64-bit integers.`,
    input_format: `The first line contains two integers $N$ and $Q$ ($1 \\le N, Q \\le 2 \\cdot 10^5$).
The second line contains $N$ integers $A_1, A_2, \\dots, A_N$ ($|A_i| \\le 10^9$).
The next $Q$ lines each describe a query in one of the two formats:
\`1 i x\` with $1 \\le i \\le N$ and $|x| \\le 10^9$
\`2 l r\` with $1 \\le l \\le r \\le N$`,
    output_format: `For each query of type 2, output the required sum on a separate line.`,
    constraints: `- $1 \\le N, Q \\le 2 \\cdot 10^5$
- $-10^9 \\le A_i, x \\le 10^9$
- $1 \\le l \\le r \\le N$
- Time complexity must be $\\mathcal{O}((N + Q) \\log N)$`,
    test_cases: [
      {
        id: 1,
        input: '5 4\n1 3 5 7 9\n2 1 3\n1 2 4\n2 1 3\n2 3 5',
        output: '9\n13\n21',
        is_sample: true,
        explanation: 'Initial array: [1, 3, 5, 7, 9]. Sum of 1..3 is 1+3+5 = 9. Update index 2 by +4: array becomes [1, 7, 5, 7, 9]. Sum 1..3 is now 1+7+5 = 13. Sum 3..5 is 5+7+9 = 21.',
      },
    ],
  },
  {
    id: 3,
    title: 'Shortest Path with K Edge Removals',
    slug: 'shortest-path-with-k-edge-removals',
    difficulty: 'Hard',
    time_limit: 2.0,
    memory_limit: 512,
    acceptance_rate: 28.4,
    total_submissions: 5120,
    total_accepted: 1454,
    status: 'unsolved',
    tags: ['Graph', 'Dijkstra', 'Dynamic Programming', 'Shortest Path'],
    description: `You are given a weighted directed graph with $V$ vertices numbered $1$ to $V$ and $E$ directed edges. Each edge $(u, v)$ has a non-negative traversal time $w$.

You are granted a special voucher that allows you to reduce the traversal time of at most $K$ edges to $0$.

Find the minimum total time required to travel from vertex $1$ to vertex $V$. If vertex $V$ is unreachable, output $-1$.`,
    input_format: `The first line contains three integers $V, E, K$ ($1 \\le V \\le 10^4, 0 \\le E \\le 5 \\cdot 10^4, 0 \\le K \\le 10$).
The following $E$ lines each describe an edge with three integers $u, v, w$ ($1 \\le u, v \\le V, u \\ne v, 0 \\le w \\le 10^9$).`,
    output_format: `Print a single integer: the minimum travel time from $1$ to $V$, or $-1$ if unreachable.`,
    constraints: `- $1 \\le V \\le 10^4$
- $0 \\le E \\le 5 \\cdot 10^4$
- $0 \\le K \\le 10$
- $0 \\le w \\le 10^9$`,
    test_cases: [
      {
        id: 1,
        input: '4 4 1\n1 2 10\n2 4 10\n1 3 5\n3 4 20',
        output: '10',
        is_sample: true,
        explanation: 'Path 1 -> 2 -> 4 costs 10 + 10 = 20. Reducing one edge gives 10 + 0 = 10. Path 1 -> 3 -> 4 with 3->4 zeroed gives 5 + 0 = 5.',
      },
    ],
  },
  {
    id: 4,
    title: 'Valid Parentheses Permutations',
    slug: 'valid-parentheses-permutations',
    difficulty: 'Easy',
    time_limit: 1.0,
    memory_limit: 128,
    acceptance_rate: 78.1,
    total_submissions: 24100,
    total_accepted: 18822,
    status: 'solved',
    tags: ['Stack', 'String'],
    description: `Given a string $s$ containing just the characters \`'('\`, \`')'\`, \`'{'\`, \`'}'\`, \`'['\` and \`']'\`, determine if the input string is valid.

An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.
3. Every close bracket has a corresponding open bracket of the same type.`,
    input_format: `A single string $s$ consisting only of parentheses characters.`,
    output_format: `Output \`true\` if the string is valid, or \`false\` otherwise.`,
    constraints: `- $1 \\le |s| \\le 10^5$
- $s$ consists of parentheses only \`()[]{}\``,
    test_cases: [
      {
        id: 1,
        input: '()[]{}',
        output: 'true',
        is_sample: true,
      },
      {
        id: 2,
        input: '(]',
        output: 'false',
        is_sample: true,
      },
    ],
  },
  {
    id: 5,
    title: 'Maximum Subarray Sum with Circular Boundary',
    slug: 'maximum-subarray-sum-with-circular-boundary',
    difficulty: 'Medium',
    time_limit: 1.0,
    memory_limit: 256,
    acceptance_rate: 39.5,
    total_submissions: 11200,
    total_accepted: 4424,
    status: 'unsolved',
    tags: ['Kadane Algorithm', 'Array', 'Dynamic Programming'],
    description: `Given a circular integer array \`nums\` of length $n$, return the maximum possible sum of a non-empty subarray of \`nums\`.

A **circular array** means the end of the array connects to the beginning of the array. Formally, the next element of \`nums[i]\` is \`nums[(i + 1) % n]\` and the previous element of \`nums[i]\` is \`nums[(i - 1 + n) % n]\`.

A subarray may only include each element of the fixed buffer \`nums\` at most once (i.e. $0 \\le \\text{len} \\le n$).`,
    input_format: `The first line contains $n$ ($1 \\le n \\le 3 \\cdot 10^4$).
The second line contains $n$ integers $a_1, a_2, \\dots, a_n$ ($-3 \\cdot 10^4 \\le a_i \\le 3 \\cdot 10^4$).`,
    output_format: `Print a single integer: the maximum circular subarray sum.`,
    constraints: `- $1 \\le n \\le 3 \\cdot 10^4$
- $-3 \\cdot 10^4 \\le nums[i] \\le 3 \\cdot 10^4$`,
    test_cases: [
      {
        id: 1,
        input: '4\n1 -2 3 -2',
        output: '3',
        is_sample: true,
        explanation: 'Subarray [3] has maximum sum 3.',
      },
      {
        id: 2,
        input: '3\n5 -3 5',
        output: '10',
        is_sample: true,
        explanation: 'Subarray [5, 5] wrapping around has maximum sum 5 + 5 = 10.',
      },
    ],
  },
  {
    id: 6,
    title: 'Tree Diameter via Double BFS',
    slug: 'tree-diameter-double-bfs',
    difficulty: 'Medium',
    time_limit: 1.0,
    memory_limit: 256,
    acceptance_rate: 52.3,
    total_submissions: 7300,
    total_accepted: 3818,
    status: 'solved',
    tags: ['Tree', 'BFS', 'DFS', 'Graph'],
    description: `Given an undirected unweighted tree with $N$ vertices labeled $1$ to $N$, find its diameter.

The **diameter** of a tree is the length of the longest simple path between any pair of nodes. The length is measured by the number of edges.`,
    input_format: `The first line contains $N$ ($1 \\le N \\le 2 \\cdot 10^5$).
The next $N - 1$ lines each contain two integers $u$ and $v$ ($1 \\le u, v \\le N$) denoting an edge.`,
    output_format: `Print the diameter of the tree.`,
    constraints: `- $1 \\le N \\le 2 \\cdot 10^5$
- The input is guaranteed to form a valid tree`,
    test_cases: [
      {
        id: 1,
        input: '5\n1 2\n1 3\n3 4\n3 5',
        output: '3',
        is_sample: true,
        explanation: 'The longest path is 2 -> 1 -> 3 -> 4 (or 2 -> 1 -> 3 -> 5), which has length 3 edges.',
      },
    ],
  },
]

export const MOCK_SUBMISSIONS: Submission[] = [
  {
    id: 1042,
    problem_id: 1,
    problem_title: 'Two Sum II - Sorted Array',
    user_id: 1,
    username: 'alex_chen',
    language: 'cpp',
    verdict: 'Accepted',
    runtime: 14,
    memory: 15600,
    test_cases_passed: 24,
    total_test_cases: 24,
    created_at: '2026-10-31T12:45:00Z',
    code: `#include <iostream>
#include <vector>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    
    int n;
    if (!(cin >> n)) return 0;
    vector<int> a(n);
    for (int i = 0; i < n; i++) cin >> a[i];
    int target;
    cin >> target;
    
    int l = 0, r = n - 1;
    while (l < r) {
        long long sum = (long long)a[l] + a[r];
        if (sum == target) {
            cout << (l + 1) << " " << (r + 1) << "\\n";
            return 0;
        } else if (sum < target) {
            l++;
        } else {
            r--;
        }
    }
    return 0;
}`,
  },
  {
    id: 1041,
    problem_id: 2,
    problem_title: 'Range Sum Query - Fenwick Tree',
    user_id: 1,
    username: 'alex_chen',
    language: 'cpp',
    verdict: 'Time Limit Exceeded',
    runtime: 1520,
    memory: 24100,
    test_cases_passed: 18,
    total_test_cases: 30,
    created_at: '2026-10-31T11:10:00Z',
    code: `// Naive linear query - causes TLE on Q = 2e5
#include <iostream>
#include <vector>
using namespace std;

int main() {
    int n, q;
    cin >> n >> q;
    vector<long long> a(n + 1);
    for (int i = 1; i <= n; i++) cin >> a[i];
    while (q--) {
        int type; cin >> type;
        if (type == 1) {
            int idx; long long val;
            cin >> idx >> val;
            a[idx] += val;
        } else {
            int l, r;
            cin >> l >> r;
            long long sum = 0;
            for (int i = l; i <= r; i++) sum += a[i];
            cout << sum << "\\n";
        }
    }
    return 0;
}`,
  },
  {
    id: 1040,
    problem_id: 4,
    problem_title: 'Valid Parentheses Permutations',
    user_id: 1,
    username: 'alex_chen',
    language: 'python',
    verdict: 'Accepted',
    runtime: 28,
    memory: 14200,
    test_cases_passed: 40,
    total_test_cases: 40,
    created_at: '2026-10-30T18:22:00Z',
    code: `import sys

def isValid(s: str) -> bool:
    stack = []
    mapping = {")": "(", "}": "{", "]": "["}
    for char in s.strip():
        if char in mapping:
            top = stack.pop() if stack else '#'
            if mapping[char] != top:
                return False
        else:
            stack.append(char)
    return not stack

if __name__ == '__main__':
    line = sys.stdin.read().strip()
    print("true" if isValid(line) else "false")`,
  },
  {
    id: 1039,
    problem_id: 2,
    problem_title: 'Range Sum Query - Fenwick Tree',
    user_id: 1,
    username: 'alex_chen',
    language: 'cpp',
    verdict: 'Wrong Answer',
    runtime: 42,
    memory: 18900,
    test_cases_passed: 4,
    total_test_cases: 30,
    created_at: '2026-10-30T14:15:00Z',
    error_message: 'Output mismatch on test 5: expected 12948281048, got 2147483647 (Integer overflow)',
    code: `// Fenwick tree with 32-bit int overflow bug
#include <iostream>
using namespace std;
int bit[200005], n;
void update(int i, int val) {
    for (; i <= n; i += i & -i) bit[i] += val;
}
int query(int i) {
    int sum = 0;
    for (; i > 0; i -= i & -i) sum += bit[i];
    return sum;
}`,
  },
  {
    id: 1038,
    problem_id: 6,
    problem_title: 'Tree Diameter via Double BFS',
    user_id: 1,
    username: 'alex_chen',
    language: 'java',
    verdict: 'Accepted',
    runtime: 180,
    memory: 54200,
    test_cases_passed: 25,
    total_test_cases: 25,
    created_at: '2026-10-29T20:05:00Z',
    code: `import java.io.*;
import java.util.*;

public class Main {
    static List<Integer>[] adj;
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        int n = Integer.parseInt(br.readLine().trim());
        adj = new ArrayList[n + 1];
        for (int i = 1; i <= n; i++) adj[i] = new ArrayList<>();
        for (int i = 0; i < n - 1; i++) {
            StringTokenizer st = new StringTokenizer(br.readLine());
            int u = Integer.parseInt(st.nextToken());
            int v = Integer.parseInt(st.nextToken());
            adj[u].add(v);
            adj[v].add(u);
        }
        int[] d1 = bfs(1, n);
        int[] d2 = bfs(d1[0], n);
        System.out.println(d2[1]);
    }
    static int[] bfs(int start, int n) {
        int[] dist = new int[n + 1];
        Arrays.fill(dist, -1);
        Queue<Integer> q = new ArrayDeque<>();
        dist[start] = 0;
        q.add(start);
        int farthest = start, maxDist = 0;
        while (!q.isEmpty()) {
            int u = q.poll();
            if (dist[u] > maxDist) {
                maxDist = dist[u];
                farthest = u;
            }
            for (int v : adj[u]) {
                if (dist[v] == -1) {
                    dist[v] = dist[u] + 1;
                    q.add(v);
                }
            }
        }
        return new int[]{farthest, maxDist};
    }
}`,
  },
]

export const STARTER_CODE: Record<string, string> = {
  cpp: `#include <iostream>
#include <vector>
#include <algorithm>

using namespace std;

int main() {
    // Fast I/O
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    // Your solution here
    
    return 0;
}
`,
  python: `import sys

def solve():
    input_data = sys.stdin.read().split()
    if not input_data:
        return
    # Your solution here

if __name__ == '__main__':
    solve()
`,
  java: `import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        StringTokenizer st;
        
        // Fast I/O & solution here
        
    }
}
`,
}

// Generate realistic 365-day submission activity
export function getMockHeatmapData(): Record<string, number> {
  const result: Record<string, number> = {}
  const now = new Date()
  for (let i = 0; i < 365; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().split('T')[0]
    // Generate sporadic realistic submission counts (0 to 6)
    const seed = (i * 37 + 13) % 100
    if (seed < 40) {
      result[key] = 0
    } else if (seed < 70) {
      result[key] = 1 + ((i * 3) % 2)
    } else if (seed < 90) {
      result[key] = 3 + ((i * 7) % 3)
    } else {
      result[key] = 6 + (i % 4)
    }
  }
  return result
}

export const MOCK_USER_STATS: UserStats = {
  total_solved: 84,
  total_submissions: 198,
  acceptance_rate: 68.4,
  easy_solved: 42,
  medium_solved: 34,
  hard_solved: 8,
  total_easy: 120,
  total_medium: 180,
  total_hard: 95,
  current_streak: 12,
  longest_streak: 28,
  submissions_by_date: getMockHeatmapData(),
}

