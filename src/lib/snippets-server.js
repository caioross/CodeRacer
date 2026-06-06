// CommonJS module consumed by the custom server.
// Snippets are short, real-world looking code fragments per language/difficulty.

const SNIPPETS = {
  javascript: {
    easy: [
      {
        title: "FizzBuzz clássico",
        code: `for (let i = 1; i <= 15; i++) {
  if (i % 15 === 0) console.log("FizzBuzz");
  else if (i % 3 === 0) console.log("Fizz");
  else if (i % 5 === 0) console.log("Buzz");
  else console.log(i);
}`
      },
      {
        title: "Soma de array",
        code: `const sum = (arr) => arr.reduce((a, b) => a + b, 0);
console.log(sum([1, 2, 3, 4, 5]));`
      },
      {
        title: "Reverse string",
        code: `function reverse(str) {
  return str.split("").reverse().join("");
}
console.log(reverse("CodeRacer"));`
      }
    ],
    medium: [
      {
        title: "Debounce util",
        code: `function debounce(fn, wait = 200) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

const log = debounce((q) => console.log("search:", q), 300);
log("hello");`
      },
      {
        title: "Fetch com retry",
        code: `async function fetchJson(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(res.statusText);
      return await res.json();
    } catch (err) {
      if (i === tries - 1) throw err;
    }
  }
}`
      }
    ],
    hard: [
      {
        title: "LRU Cache (Map)",
        code: `class LRU {
  constructor(max = 100) { this.max = max; this.map = new Map(); }
  get(key) {
    if (!this.map.has(key)) return undefined;
    const v = this.map.get(key);
    this.map.delete(key); this.map.set(key, v);
    return v;
  }
  set(key, value) {
    if (this.map.has(key)) this.map.delete(key);
    else if (this.map.size >= this.max) this.map.delete(this.map.keys().next().value);
    this.map.set(key, value);
  }
}`
      }
    ]
  },
  typescript: {
    easy: [
      {
        title: "Tipos básicos",
        code: `type User = { id: string; name: string; age: number };

const greet = (u: User): string => \`hi \${u.name}, \${u.age}\`;
console.log(greet({ id: "1", name: "Caio", age: 28 }));`
      },
      {
        title: "Filter genérico",
        code: `function filter<T>(arr: T[], fn: (x: T) => boolean): T[] {
  return arr.filter(fn);
}
const nums = filter([1, 2, 3, 4], (n) => n % 2 === 0);`
      }
    ],
    medium: [
      {
        title: "Result type",
        code: `type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

function divide(a: number, b: number): Result<number> {
  if (b === 0) return { ok: false, error: new Error("div/0") };
  return { ok: true, value: a / b };
}`
      }
    ],
    hard: [
      {
        title: "Mapped + Conditional",
        code: `type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K];
};

type Config = { server: { port: number; host: string }; debug: boolean };
const cfg: DeepReadonly<Config> = {
  server: { port: 3000, host: "localhost" },
  debug: true,
};`
      }
    ]
  },
  python: {
    easy: [
      {
        title: "FizzBuzz",
        code: `for i in range(1, 16):
    if i % 15 == 0:
        print("FizzBuzz")
    elif i % 3 == 0:
        print("Fizz")
    elif i % 5 == 0:
        print("Buzz")
    else:
        print(i)`
      },
      {
        title: "List comprehension",
        code: `nums = [1, 2, 3, 4, 5, 6]
squares = [n * n for n in nums if n % 2 == 0]
print(squares)`
      }
    ],
    medium: [
      {
        title: "Word counter",
        code: `from collections import Counter

text = "the quick brown fox jumps over the lazy dog the fox"
counts = Counter(text.lower().split())
for word, n in counts.most_common(3):
    print(f"{word}: {n}")`
      },
      {
        title: "Decorator de cache",
        code: `from functools import lru_cache

@lru_cache(maxsize=128)
def fib(n: int) -> int:
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)

print(fib(30))`
      }
    ],
    hard: [
      {
        title: "Async producer/consumer",
        code: `import asyncio

async def producer(q: asyncio.Queue):
    for i in range(5):
        await q.put(i)
        await asyncio.sleep(0.1)
    await q.put(None)

async def consumer(q: asyncio.Queue):
    while True:
        item = await q.get()
        if item is None:
            break
        print("got", item)

async def main():
    q: asyncio.Queue = asyncio.Queue()
    await asyncio.gather(producer(q), consumer(q))

asyncio.run(main())`
      }
    ]
  },
  java: {
    easy: [
      {
        title: "Hello World",
        code: `public class Main {
    public static void main(String[] args) {
        for (int i = 1; i <= 5; i++) {
            System.out.println("Hello #" + i);
        }
    }
}`
      }
    ],
    medium: [
      {
        title: "Stream API",
        code: `import java.util.*;
import java.util.stream.*;

public class Sum {
    public static void main(String[] args) {
        List<Integer> nums = Arrays.asList(1, 2, 3, 4, 5);
        int total = nums.stream()
            .filter(n -> n % 2 == 0)
            .mapToInt(Integer::intValue)
            .sum();
        System.out.println(total);
    }
}`
      }
    ],
    hard: [
      {
        title: "Generic Pair",
        code: `public class Pair<A, B> {
    private final A first;
    private final B second;

    public Pair(A first, B second) {
        this.first = first;
        this.second = second;
    }

    public A getFirst() { return first; }
    public B getSecond() { return second; }

    @Override
    public String toString() {
        return "(" + first + ", " + second + ")";
    }
}`
      }
    ]
  },
  csharp: {
    easy: [
      {
        title: "LINQ Where",
        code: `using System;
using System.Linq;

class Program {
    static void Main() {
        var nums = new[] { 1, 2, 3, 4, 5 };
        var even = nums.Where(n => n % 2 == 0).ToArray();
        Console.WriteLine(string.Join(",", even));
    }
}`
      }
    ],
    medium: [
      {
        title: "Async/await HTTP",
        code: `using System;
using System.Net.Http;
using System.Threading.Tasks;

class Program {
    static async Task Main() {
        using var http = new HttpClient();
        var body = await http.GetStringAsync("https://example.com");
        Console.WriteLine(body.Length);
    }
}`
      }
    ],
    hard: [
      {
        title: "Record + pattern matching",
        code: `using System;

public record Shape;
public record Circle(double Radius) : Shape;
public record Square(double Side) : Shape;

class Program {
    static double Area(Shape s) => s switch {
        Circle c => Math.PI * c.Radius * c.Radius,
        Square q => q.Side * q.Side,
        _ => 0
    };

    static void Main() {
        Console.WriteLine(Area(new Circle(3)));
        Console.WriteLine(Area(new Square(4)));
    }
}`
      }
    ]
  },
  cpp: {
    easy: [
      {
        title: "Hello loop",
        code: `#include <iostream>

int main() {
    for (int i = 0; i < 5; ++i) {
        std::cout << "i = " << i << "\\n";
    }
    return 0;
}`
      }
    ],
    medium: [
      {
        title: "Vector + algorithm",
        code: `#include <iostream>
#include <vector>
#include <algorithm>

int main() {
    std::vector<int> v{5, 2, 8, 1, 9, 3};
    std::sort(v.begin(), v.end());
    for (int x : v) std::cout << x << " ";
    std::cout << "\\n";
    return 0;
}`
      }
    ],
    hard: [
      {
        title: "Template + RAII",
        code: `#include <memory>
#include <iostream>

template <typename T>
class Stack {
    std::unique_ptr<T[]> data;
    size_t cap, top = 0;
public:
    explicit Stack(size_t c) : data(std::make_unique<T[]>(c)), cap(c) {}
    void push(T v) { if (top < cap) data[top++] = v; }
    T pop() { return data[--top]; }
    bool empty() const { return top == 0; }
};

int main() {
    Stack<int> s(8);
    s.push(1); s.push(2); s.push(3);
    while (!s.empty()) std::cout << s.pop() << " ";
}`
      }
    ]
  },
  go: {
    easy: [
      {
        title: "Hello loop",
        code: `package main

import "fmt"

func main() {
    for i := 0; i < 5; i++ {
        fmt.Println("hello", i)
    }
}`
      }
    ],
    medium: [
      {
        title: "Goroutines + channel",
        code: `package main

import (
    "fmt"
    "sync"
)

func worker(id int, jobs <-chan int, wg *sync.WaitGroup) {
    defer wg.Done()
    for j := range jobs {
        fmt.Printf("worker %d got %d\n", id, j)
    }
}

func main() {
    jobs := make(chan int, 5)
    var wg sync.WaitGroup
    for w := 1; w <= 3; w++ {
        wg.Add(1)
        go worker(w, jobs, &wg)
    }
    for j := 1; j <= 5; j++ {
        jobs <- j
    }
    close(jobs)
    wg.Wait()
}`
      }
    ],
    hard: [
      {
        title: "HTTP server + middleware",
        code: `package main

import (
    "log"
    "net/http"
    "time"
)

func logger(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        start := time.Now()
        next.ServeHTTP(w, r)
        log.Printf("%s %s %v", r.Method, r.URL.Path, time.Since(start))
    })
}

func main() {
    mux := http.NewServeMux()
    mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
        w.Write([]byte("hello"))
    })
    log.Fatal(http.ListenAndServe(":8080", logger(mux)))
}`
      }
    ]
  },
  rust: {
    easy: [
      {
        title: "Hello loop",
        code: `fn main() {
    for i in 0..5 {
        println!("hello {}", i);
    }
}`
      }
    ],
    medium: [
      {
        title: "Vec + iter",
        code: `fn main() {
    let nums = vec![1, 2, 3, 4, 5];
    let squares: Vec<i32> = nums.iter().map(|n| n * n).collect();
    let sum: i32 = squares.iter().sum();
    println!("sum of squares = {}", sum);
}`
      }
    ],
    hard: [
      {
        title: "Trait + generics",
        code: `use std::fmt::Display;

trait Greet {
    fn greet(&self) -> String;
}

struct User<T: Display> { name: T }

impl<T: Display> Greet for User<T> {
    fn greet(&self) -> String {
        format!("hello, {}!", self.name)
    }
}

fn main() {
    let u = User { name: "Caio" };
    println!("{}", u.greet());
}`
      }
    ]
  }
};

function normalizeLang(l) {
  const m = String(l || "").toLowerCase();
  if (m === "ts") return "typescript";
  if (m === "js") return "javascript";
  if (m === "py") return "python";
  if (m === "c++" || m === "cplusplus") return "cpp";
  if (m === "c#" || m === "cs") return "csharp";
  return m;
}

function pickSnippet(language, difficulty) {
  const lang = normalizeLang(language) || "javascript";
  const diff = ["easy", "medium", "hard"].includes(difficulty) ? difficulty : "medium";
  const langBucket = SNIPPETS[lang] || SNIPPETS.javascript;
  const pool = langBucket[diff] || langBucket.medium || langBucket.easy;
  const choice = pool[Math.floor(Math.random() * pool.length)];
  return {
    title: choice.title,
    code: choice.code,
    language: lang,
    difficulty: diff
  };
}

module.exports = { pickSnippet, SNIPPETS };
