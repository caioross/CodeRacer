// Snippet pool, consumed server-side by the API routes (room start).
// Short, real-world-looking code fragments per language / difficulty.
import type { Difficulty, LangId } from "./languages";

export interface SnippetSeed {
  title: string;
  code: string;
}

type Pool = Record<string, Partial<Record<Difficulty, SnippetSeed[]>>>;

// Exportado para os testes (`snippets.test.ts` versiona os invariantes do pool:
// 72 buckets populados, títulos únicos por bucket). Nenhum componente de cliente
// importa este módulo — os snippets continuam saindo só pelas rotas de API.
export const SNIPPETS: Pool = {
javascript: {
    easy: [
      { title: "Soma de array", code: `function soma(numeros) {
  let total = 0;
  for (const n of numeros) {
    total += n;
  }
  return total;
}` },
      { title: "Inverter string", code: `function inverter(texto) {
  return texto.split("").reverse().join("");
}` },
      { title: "Número par", code: `function ehPar(n) {
  return n % 2 === 0;
}

const pares = [1, 2, 3, 4, 5, 6].filter(ehPar);
console.log(pares);` },
      { title: "Fatorial iterativo", code: `function fatorial(n) {
  let resultado = 1;
  for (let i = 2; i <= n; i++) {
    resultado *= i;
  }
  return resultado;
}` },
      { title: "Maior valor", code: `function maior(lista) {
  let max = lista[0];
  for (const item of lista) {
    if (item > max) max = item;
  }
  return max;
}` }
    ],
    medium: [
      { title: "Debounce util", code: `function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

const log = debounce((msg) => console.log(msg), 300);
log("primeira");
log("ultima");` },
      { title: "Agrupar por chave", code: `function agruparPor(itens, chave) {
  return itens.reduce((acc, item) => {
    const valor = item[chave];
    (acc[valor] = acc[valor] || []).push(item);
    return acc;
  }, {});
}

const usuarios = [{ tipo: "admin" }, { tipo: "user" }];
console.log(agruparPor(usuarios, "tipo"));` },
      { title: "Fetch com timeout", code: `async function fetchComTimeout(url, ms) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const resposta = await fetch(url, { signal: controller.signal });
    return await resposta.json();
  } finally {
    clearTimeout(id);
  }
}` },
      { title: "Achatar array", code: `function achatar(arr) {
  return arr.reduce((plano, item) => {
    if (Array.isArray(item)) {
      return plano.concat(achatar(item));
    }
    return plano.concat(item);
  }, []);
}

console.log(achatar([1, [2, [3, [4]], 5]]));` },
      { title: "Contador de palavras", code: `function contarPalavras(texto) {
  const mapa = new Map();
  for (const palavra of texto.toLowerCase().split(/\s+/)) {
    if (!palavra) continue;
    mapa.set(palavra, (mapa.get(palavra) || 0) + 1);
  }
  return mapa;
}` }
    ],
    hard: [
      { title: "Memoization genérica", code: `function memoize(fn) {
  const cache = new Map();
  return function (...args) {
    const chave = JSON.stringify(args);
    if (cache.has(chave)) {
      return cache.get(chave);
    }
    const resultado = fn.apply(this, args);
    cache.set(chave, resultado);
    return resultado;
  };
}

const fib = memoize(function (n) {
  return n < 2 ? n : fib(n - 1) + fib(n - 2);
});

console.log(fib(40));` },
      { title: "Promise pool", code: `async function poolDePromessas(tarefas, limite) {
  const resultados = [];
  const emExecucao = new Set();
  for (const tarefa of tarefas) {
    const p = Promise.resolve().then(() => tarefa());
    resultados.push(p);
    emExecucao.add(p);
    p.finally(() => emExecucao.delete(p));
    if (emExecucao.size >= limite) {
      await Promise.race(emExecucao);
    }
  }
  return Promise.all(resultados);
}` },
      { title: "EventEmitter simples", code: `class EventEmitter {
  constructor() {
    this.ouvintes = new Map();
  }

  on(evento, callback) {
    if (!this.ouvintes.has(evento)) {
      this.ouvintes.set(evento, []);
    }
    this.ouvintes.get(evento).push(callback);
    return this;
  }

  emit(evento, ...args) {
    const callbacks = this.ouvintes.get(evento) || [];
    for (const cb of callbacks) {
      cb(...args);
    }
    return this;
  }
}` },
      { title: "Curry de função", code: `function curry(fn) {
  return function curried(...args) {
    if (args.length >= fn.length) {
      return fn.apply(this, args);
    }
    return function (...resto) {
      return curried.apply(this, args.concat(resto));
    };
  };
}

const somar = curry((a, b, c) => a + b + c);
console.log(somar(1)(2)(3));
console.log(somar(1, 2)(3));` },
      { title: "Deep clone", code: `function clonarProfundo(valor, visto = new WeakMap()) {
  if (valor === null || typeof valor !== "object") {
    return valor;
  }
  if (visto.has(valor)) {
    return visto.get(valor);
  }
  const copia = Array.isArray(valor) ? [] : {};
  visto.set(valor, copia);
  for (const chave of Object.keys(valor)) {
    copia[chave] = clonarProfundo(valor[chave], visto);
  }
  return copia;
}` }
    ]
  },
  typescript: {
    easy: [
      { title: "Capitalizar texto", code: `function capitalizar(texto: string): string {
  if (texto.length === 0) return texto;
  return texto[0].toUpperCase() + texto.slice(1);
}` },
      { title: "Tipo de ponto", code: `interface Ponto {
  x: number;
  y: number;
}

function distancia(a: Ponto, b: Ponto): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}` },
      { title: "Enum de status", code: `enum Status {
  Ativo = "ATIVO",
  Inativo = "INATIVO",
}

function descrever(s: Status): string {
  return s === Status.Ativo ? "esta ativo" : "esta inativo";
}` },
      { title: "Soma variádica", code: `function somar(...valores: number[]): number {
  return valores.reduce((acc, v) => acc + v, 0);
}

const total: number = somar(1, 2, 3, 4);
console.log(total);` },
      { title: "Filtrar definidos", code: `function semNulos<T>(itens: (T | null)[]): T[] {
  return itens.filter((item): item is T => item !== null);
}` }
    ],
    medium: [
      { title: "Resultado tipado", code: `type Resultado<T> =
  | { ok: true; valor: T }
  | { ok: false; erro: string };

function dividir(a: number, b: number): Resultado<number> {
  if (b === 0) {
    return { ok: false, erro: "divisao por zero" };
  }
  return { ok: true, valor: a / b };
}` },
      { title: "Fila genérica", code: `class Fila<T> {
  private itens: T[] = [];

  enfileirar(item: T): void {
    this.itens.push(item);
  }

  desenfileirar(): T | undefined {
    return this.itens.shift();
  }

  get tamanho(): number {
    return this.itens.length;
  }
}` },
      { title: "Mapear registro", code: `function mapearValores<K extends string, A, B>(
  registro: Record<K, A>,
  fn: (valor: A) => B,
): Record<K, B> {
  const saida = {} as Record<K, B>;
  for (const chave of Object.keys(registro) as K[]) {
    saida[chave] = fn(registro[chave]);
  }
  return saida;
}` },
      { title: "Retry assíncrono", code: `async function tentarNovamente<T>(
  fn: () => Promise<T>,
  tentativas: number,
): Promise<T> {
  let ultimoErro: unknown;
  for (let i = 0; i < tentativas; i++) {
    try {
      return await fn();
    } catch (erro) {
      ultimoErro = erro;
    }
  }
  throw ultimoErro;
}` },
      { title: "Type guard de objeto", code: `interface Usuario {
  nome: string;
  idade: number;
}

function ehUsuario(valor: unknown): valor is Usuario {
  return (
    typeof valor === "object" &&
    valor !== null &&
    "nome" in valor &&
    "idade" in valor
  );
}` }
    ],
    hard: [
      { title: "LRU Cache genérico", code: `class LRUCache<K, V> {
  private mapa = new Map<K, V>();

  constructor(private capacidade: number) {}

  obter(chave: K): V | undefined {
    if (!this.mapa.has(chave)) return undefined;
    const valor = this.mapa.get(chave)!;
    this.mapa.delete(chave);
    this.mapa.set(chave, valor);
    return valor;
  }

  inserir(chave: K, valor: V): void {
    if (this.mapa.has(chave)) {
      this.mapa.delete(chave);
    } else if (this.mapa.size >= this.capacidade) {
      const maisAntiga = this.mapa.keys().next().value;
      this.mapa.delete(maisAntiga);
    }
    this.mapa.set(chave, valor);
  }
}` },
      { title: "Pipe tipado", code: `type Fn<A, B> = (entrada: A) => B;

function pipe<A, B, C>(f: Fn<A, B>, g: Fn<B, C>): Fn<A, C>;
function pipe<A, B, C, D>(
  f: Fn<A, B>,
  g: Fn<B, C>,
  h: Fn<C, D>,
): Fn<A, D>;
function pipe(...fns: Array<Fn<unknown, unknown>>): Fn<unknown, unknown> {
  return (entrada: unknown) => fns.reduce((acc, fn) => fn(acc), entrada);
}

const transformar = pipe(
  (x: number) => x + 1,
  (x: number) => x * 2,
  (x: number) => String(x),
);` },
      { title: "Observable mínimo", code: `type Observador<T> = (valor: T) => void;

class Sujeito<T> {
  private observadores = new Set<Observador<T>>();

  inscrever(obs: Observador<T>): () => void {
    this.observadores.add(obs);
    return () => this.observadores.delete(obs);
  }

  emitir(valor: T): void {
    for (const obs of this.observadores) {
      obs(valor);
    }
  }
}

const fonte = new Sujeito<number>();
const cancelar = fonte.inscrever((v) => console.log(v));
fonte.emitir(42);
cancelar();` },
      { title: "Decorator de log", code: `function logado(
  alvo: unknown,
  chave: string,
  descritor: PropertyDescriptor,
): PropertyDescriptor {
  const original = descritor.value;
  descritor.value = function (...args: unknown[]) {
    console.log("chamando " + chave, args);
    const retorno = original.apply(this, args);
    console.log("retornou", retorno);
    return retorno;
  };
  return descritor;
}

class Calculadora {
  @logado
  somar(a: number, b: number): number {
    return a + b;
  }
}` },
      { title: "Deep Readonly", code: `type ProfundoSomenteLeitura<T> = {
  readonly [K in keyof T]: T[K] extends object
    ? ProfundoSomenteLeitura<T[K]>
    : T[K];
};

interface Config {
  servidor: {
    host: string;
    portas: number[];
  };
  debug: boolean;
}

const config: ProfundoSomenteLeitura<Config> = {
  servidor: { host: "localhost", portas: [80, 443] },
  debug: false,
};` }
    ]
  },
  python: {
    easy: [
      { title: "Soma de lista", code: `def soma(numeros):
    total = 0
    for n in numeros:
        total += n
    return total` },
      { title: "Verificar palíndromo", code: `def eh_palindromo(texto):
    limpo = texto.lower().replace(" ", "")
    return limpo == limpo[::-1]` },
      { title: "Contagem regressiva", code: `def contagem_regressiva(n):
    while n > 0:
        print(n)
        n -= 1
    print("fim")` },
      { title: "Média de notas", code: `def media(notas):
    if not notas:
        return 0.0
    return sum(notas) / len(notas)


print(media([7.5, 8.0, 6.5]))` },
      { title: "Quadrados pares", code: `def quadrados_pares(limite):
    return [x * x for x in range(limite) if x % 2 == 0]


print(quadrados_pares(10))` }
    ],
    medium: [
      { title: "Sequência de Fibonacci", code: `def fibonacci(n):
    a, b = 0, 1
    sequencia = []
    for _ in range(n):
        sequencia.append(a)
        a, b = b, a + b
    return sequencia


print(fibonacci(10))` },
      { title: "Decorator de tempo", code: `import time
from functools import wraps


def cronometrar(funcao):
    @wraps(funcao)
    def invocar(*args, **kwargs):
        inicio = time.perf_counter()
        resultado = funcao(*args, **kwargs)
        duracao = time.perf_counter() - inicio
        print(f"{funcao.__name__} levou {duracao:.4f}s")
        return resultado
    return invocar` },
      { title: "Agrupar por paridade", code: `from collections import defaultdict


def agrupar_paridade(numeros):
    grupos = defaultdict(list)
    for n in numeros:
        chave = "par" if n % 2 == 0 else "impar"
        grupos[chave].append(n)
    return dict(grupos)


print(agrupar_paridade([1, 2, 3, 4, 5]))` },
      { title: "Gerador de lotes", code: `def em_lotes(iteravel, tamanho):
    lote = []
    for item in iteravel:
        lote.append(item)
        if len(lote) == tamanho:
            yield lote
            lote = []
    if lote:
        yield lote


for grupo in em_lotes(range(7), 3):
    print(grupo)` },
      { title: "Contexto de arquivo", code: `from contextlib import contextmanager


@contextmanager
def aberto_seguro(caminho, modo):
    arquivo = open(caminho, modo, encoding="utf-8")
    try:
        yield arquivo
    finally:
        arquivo.close()


with aberto_seguro("dados.txt", "w") as f:
    f.write("ola")` }
    ],
    hard: [
      { title: "Busca binária", code: `def busca_binaria(lista, alvo):
    inicio, fim = 0, len(lista) - 1
    while inicio <= fim:
        meio = (inicio + fim) // 2
        if lista[meio] == alvo:
            return meio
        if lista[meio] < alvo:
            inicio = meio + 1
        else:
            fim = meio - 1
    return -1


indices = busca_binaria([1, 3, 5, 7, 9, 11], 7)
print(indices)` },
      { title: "Ordenação merge sort", code: `def merge_sort(lista):
    if len(lista) <= 1:
        return lista
    meio = len(lista) // 2
    esquerda = merge_sort(lista[:meio])
    direita = merge_sort(lista[meio:])
    return intercalar(esquerda, direita)


def intercalar(a, b):
    resultado = []
    i = j = 0
    while i < len(a) and j < len(b):
        if a[i] <= b[j]:
            resultado.append(a[i])
            i += 1
        else:
            resultado.append(b[j])
            j += 1
    resultado.extend(a[i:])
    resultado.extend(b[j:])
    return resultado` },
      { title: "Classe de dados", code: `from dataclasses import dataclass, field
from typing import List


@dataclass(order=True)
class Produto:
    nome: str = field(compare=False)
    preco: float = 0.0
    tags: List[str] = field(default_factory=list, compare=False)

    def com_desconto(self, percentual):
        fator = 1 - percentual / 100
        return Produto(self.nome, self.preco * fator, list(self.tags))


itens = [Produto("A", 30.0), Produto("B", 10.0)]
itens.sort()
print(itens[0].nome)` },
      { title: "Memoização com lru_cache", code: `from functools import lru_cache


@lru_cache(maxsize=None)
def caminhos(linhas, colunas):
    if linhas == 0 or colunas == 0:
        return 1
    return caminhos(linhas - 1, colunas) + caminhos(linhas, colunas - 1)


def total_caminhos(grade):
    return caminhos(grade, grade)


print(total_caminhos(10))` },
      { title: "Travessia em largura", code: `from collections import deque


def bfs(grafo, inicio):
    visitados = set()
    fila = deque([inicio])
    ordem = []
    while fila:
        no = fila.popleft()
        if no in visitados:
            continue
        visitados.add(no)
        ordem.append(no)
        for vizinho in grafo.get(no, []):
            if vizinho not in visitados:
                fila.append(vizinho)
    return ordem


grafo = {"a": ["b", "c"], "b": ["d"], "c": ["d"], "d": []}
print(bfs(grafo, "a"))` }
    ]
  },
java: {
    easy: [
      { title: "Olá mundo", code: `public class Main {
    public static void main(String[] args) {
        System.out.println("Olá, mundo!");
    }
}` },
      { title: "Soma de inteiros", code: `public class Calculadora {
    public int somar(int a, int b) {
        return a + b;
    }
}` },
      { title: "Fatorial iterativo", code: `public long fatorial(int n) {
    long resultado = 1;
    for (int i = 2; i <= n; i++) {
        resultado *= i;
    }
    return resultado;
}` },
      { title: "Número par", code: `public boolean ehPar(int numero) {
    return numero % 2 == 0;
}` },
      { title: "Inverter texto", code: `public String inverter(String texto) {
    StringBuilder sb = new StringBuilder(texto);
    return sb.reverse().toString();
}` }
    ],
    medium: [
      { title: "Stream API", code: `import java.util.List;

public int somarPares(List<Integer> numeros) {
    return numeros.stream()
            .filter(n -> n % 2 == 0)
            .mapToInt(Integer::intValue)
            .sum();
}` },
      { title: "Busca binária", code: `public int buscaBinaria(int[] arr, int alvo) {
    int baixo = 0, alto = arr.length - 1;
    while (baixo <= alto) {
        int meio = baixo + (alto - baixo) / 2;
        if (arr[meio] == alvo) {
            return meio;
        } else if (arr[meio] < alvo) {
            baixo = meio + 1;
        } else {
            alto = meio - 1;
        }
    }
    return -1;
}` },
      { title: "Agrupar por tamanho", code: `import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public Map<Integer, List<String>> agrupar(List<String> palavras) {
    return palavras.stream()
            .collect(Collectors.groupingBy(String::length));
}` },
      { title: "Record imutável", code: `public record Ponto(int x, int y) {
    public double distancia(Ponto outro) {
        int dx = x - outro.x();
        int dy = y - outro.y();
        return Math.sqrt(dx * dx + dy * dy);
    }
}` },
      { title: "Contar frequência", code: `import java.util.HashMap;
import java.util.Map;

public Map<Character, Integer> contar(String texto) {
    Map<Character, Integer> freq = new HashMap<>();
    for (char c : texto.toCharArray()) {
        freq.merge(c, 1, Integer::sum);
    }
    return freq;
}` }
    ],
    hard: [
      { title: "Generics com limites", code: `import java.util.List;

public class Caixa<T extends Comparable<T>> {
    private final List<T> itens;

    public Caixa(List<T> itens) {
        this.itens = itens;
    }

    public T maximo() {
        T max = itens.get(0);
        for (T item : itens) {
            if (item.compareTo(max) > 0) {
                max = item;
            }
        }
        return max;
    }
}` },
      { title: "Produtor consumidor", code: `import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;

public class Buffer {
    private final BlockingQueue<Integer> fila = new LinkedBlockingQueue<>(10);

    public void produzir(int valor) throws InterruptedException {
        fila.put(valor);
    }

    public int consumir() throws InterruptedException {
        return fila.take();
    }
}` },
      { title: "Padrão Builder", code: `public class Usuario {
    private final String nome;
    private final int idade;

    private Usuario(Builder builder) {
        this.nome = builder.nome;
        this.idade = builder.idade;
    }

    public static class Builder {
        private String nome;
        private int idade;

        public Builder nome(String nome) {
            this.nome = nome;
            return this;
        }

        public Builder idade(int idade) {
            this.idade = idade;
            return this;
        }

        public Usuario build() {
            return new Usuario(this);
        }
    }
}` },
      { title: "Memoização com cache", code: `import java.util.HashMap;
import java.util.Map;

public class Fibonacci {
    private final Map<Integer, Long> cache = new HashMap<>();

    public long calcular(int n) {
        if (n <= 1) {
            return n;
        }
        return cache.computeIfAbsent(n, k -> calcular(k - 1) + calcular(k - 2));
    }
}` },
      { title: "CompletableFuture", code: `import java.util.concurrent.CompletableFuture;

public class Servico {
    public CompletableFuture<String> buscarDados() {
        return CompletableFuture
                .supplyAsync(() -> "dados brutos")
                .thenApply(String::toUpperCase)
                .thenApply(s -> "[" + s + "]");
    }
}` }
    ]
  },
  csharp: {
    easy: [
      { title: "Olá mundo", code: `using System;

class Program
{
    static void Main()
    {
        Console.WriteLine("Olá, mundo!");
    }
}` },
      { title: "Propriedade automática", code: `public class Pessoa
{
    public string Nome { get; set; }
    public int Idade { get; set; }
}` },
      { title: "Verificar primo", code: `public bool EhPrimo(int n)
{
    if (n < 2) return false;
    for (int i = 2; i * i <= n; i++)
    {
        if (n % i == 0) return false;
    }
    return true;
}` },
      { title: "Somar lista", code: `public int Somar(int[] numeros)
{
    int total = 0;
    foreach (int n in numeros)
    {
        total += n;
    }
    return total;
}` },
      { title: "Expressão lambda", code: `using System;

Func<int, int, int> multiplicar = (a, b) => a * b;
Console.WriteLine(multiplicar(6, 7));` }
    ],
    medium: [
      { title: "Consulta LINQ", code: `using System.Collections.Generic;
using System.Linq;

public List<int> FiltrarPares(List<int> numeros)
{
    return numeros
        .Where(n => n % 2 == 0)
        .OrderByDescending(n => n)
        .ToList();
}` },
      { title: "Dicionário agrupado", code: `using System.Collections.Generic;
using System.Linq;

public Dictionary<char, int> Frequencia(string texto)
{
    return texto
        .GroupBy(c => c)
        .ToDictionary(g => g.Key, g => g.Count());
}` },
      { title: "Método assíncrono", code: `using System.Net.Http;
using System.Threading.Tasks;

public async Task<string> BaixarAsync(string url)
{
    using var cliente = new HttpClient();
    string conteudo = await cliente.GetStringAsync(url);
    return conteudo.Trim();
}` },
      { title: "Pattern matching", code: `public string Descrever(object valor) => valor switch
{
    int n when n > 0 => "positivo",
    int => "não positivo",
    string s => $"texto de {s.Length} chars",
    null => "nulo",
    _ => "desconhecido"
};` },
      { title: "Record com with", code: `public record Produto(string Nome, decimal Preco);

public Produto AplicarDesconto(Produto p, decimal pct)
{
    return p with { Preco = p.Preco * (1 - pct) };
}` }
    ],
    hard: [
      { title: "Método de extensão", code: `using System;
using System.Collections.Generic;

public static class Extensoes
{
    public static IEnumerable<IEnumerable<T>> EmLotes<T>(
        this IEnumerable<T> fonte, int tamanho)
    {
        var lote = new List<T>(tamanho);
        foreach (var item in fonte)
        {
            lote.Add(item);
            if (lote.Count == tamanho)
            {
                yield return lote;
                lote = new List<T>(tamanho);
            }
        }
        if (lote.Count > 0)
        {
            yield return lote;
        }
    }
}` },
      { title: "Cancelamento de tarefa", code: `using System;
using System.Threading;
using System.Threading.Tasks;

public class Trabalhador
{
    public async Task ProcessarAsync(CancellationToken token)
    {
        for (int i = 0; i < 100; i++)
        {
            token.ThrowIfCancellationRequested();
            await Task.Delay(50, token);
            Console.WriteLine($"Etapa {i} concluída");
        }
    }
}` },
      { title: "IDisposable e using", code: `using System;

public class Recurso : IDisposable
{
    private bool _liberado;

    public void Usar()
    {
        if (_liberado)
        {
            throw new ObjectDisposedException(nameof(Recurso));
        }
        Console.WriteLine("Usando recurso");
    }

    public void Dispose()
    {
        if (!_liberado)
        {
            Console.WriteLine("Liberando recurso");
            _liberado = true;
        }
    }
}` },
      { title: "Genérico com restrição", code: `using System;
using System.Collections.Generic;

public class Repositorio<T> where T : class, new()
{
    private readonly List<T> _itens = new();

    public T Criar()
    {
        var item = new T();
        _itens.Add(item);
        return item;
    }

    public IReadOnlyList<T> Todos => _itens.AsReadOnly();
}` },
      { title: "Evento e delegate", code: `using System;

public class Botao
{
    public event EventHandler<string> Clicado;

    public void Pressionar(string rotulo)
    {
        OnClicado(rotulo);
    }

    protected virtual void OnClicado(string rotulo)
    {
        Clicado?.Invoke(this, rotulo);
    }
}` }
    ]
  },
  cpp: {
    easy: [
      { title: "Olá mundo", code: `#include <iostream>

int main() {
    std::cout << "Olá, mundo!" << std::endl;
    return 0;
}` },
      { title: "Troca por referência", code: `void trocar(int& a, int& b) {
    int temp = a;
    a = b;
    b = temp;
}` },
      { title: "Máximo divisor comum", code: `int mdc(int a, int b) {
    while (b != 0) {
        int t = b;
        b = a % b;
        a = t;
    }
    return a;
}` },
      { title: "Soma de vetor", code: `#include <vector>

int somar(const std::vector<int>& v) {
    int total = 0;
    for (int x : v) {
        total += x;
    }
    return total;
}` },
      { title: "Potência recursiva", code: `long long potencia(int base, int exp) {
    if (exp == 0) {
        return 1;
    }
    return base * potencia(base, exp - 1);
}` }
    ],
    medium: [
      { title: "Ordenar com lambda", code: `#include <vector>
#include <algorithm>

void ordenarDecrescente(std::vector<int>& v) {
    std::sort(v.begin(), v.end(), [](int a, int b) {
        return a > b;
    });
}` },
      { title: "Mapa de frequência", code: `#include <string>
#include <unordered_map>

std::unordered_map<char, int> contar(const std::string& texto) {
    std::unordered_map<char, int> freq;
    for (char c : texto) {
        ++freq[c];
    }
    return freq;
}` },
      { title: "Template de máximo", code: `template <typename T>
T maximo(const T& a, const T& b) {
    return (a > b) ? a : b;
}

#include <string>
auto m = maximo<std::string>("abc", "xyz");` },
      { title: "Transform e acumular", code: `#include <vector>
#include <numeric>
#include <algorithm>

int somaQuadrados(const std::vector<int>& v) {
    std::vector<int> q(v.size());
    std::transform(v.begin(), v.end(), q.begin(), [](int x) {
        return x * x;
    });
    return std::accumulate(q.begin(), q.end(), 0);
}` },
      { title: "Struct com operador", code: `#include <iostream>

struct Vetor2D {
    double x, y;

    Vetor2D operator+(const Vetor2D& o) const {
        return {x + o.x, y + o.y};
    }
};

std::ostream& operator<<(std::ostream& os, const Vetor2D& v) {
    return os << "(" << v.x << ", " << v.y << ")";
}` }
    ],
    hard: [
      { title: "Smart pointer único", code: `#include <memory>
#include <string>
#include <iostream>

class Recurso {
public:
    explicit Recurso(std::string nome) : nome_(std::move(nome)) {
        std::cout << "Criando " << nome_ << "\n";
    }
    ~Recurso() {
        std::cout << "Destruindo " << nome_ << "\n";
    }
    void usar() const {
        std::cout << "Usando " << nome_ << "\n";
    }
private:
    std::string nome_;
};

void exemplo() {
    auto r = std::make_unique<Recurso>("buffer");
    r->usar();
}` },
      { title: "RAII com lock", code: `#include <mutex>
#include <thread>
#include <vector>

class Contador {
public:
    void incrementar() {
        std::lock_guard<std::mutex> trava(mutex_);
        ++valor_;
    }
    int valor() const {
        std::lock_guard<std::mutex> trava(mutex_);
        return valor_;
    }
private:
    mutable std::mutex mutex_;
    int valor_ = 0;
};` },
      { title: "Template variádico", code: `#include <iostream>

template <typename T>
T somar(T valor) {
    return valor;
}

template <typename T, typename... Args>
T somar(T primeiro, Args... resto) {
    return primeiro + somar(resto...);
}

void exemplo() {
    std::cout << somar(1, 2, 3, 4, 5) << "\n";
    std::cout << somar(1.5, 2.5, 3.0) << "\n";
}` },
      { title: "Move semantics", code: `#include <vector>
#include <utility>
#include <iostream>

class Buffer {
public:
    explicit Buffer(size_t n) : dados_(n) {}

    Buffer(Buffer&& outro) noexcept
        : dados_(std::move(outro.dados_)) {
        std::cout << "Movido\n";
    }

    Buffer& operator=(Buffer&& outro) noexcept {
        dados_ = std::move(outro.dados_);
        return *this;
    }

    size_t tamanho() const {
        return dados_.size();
    }
private:
    std::vector<int> dados_;
};` },
      { title: "Functor com estado", code: `#include <vector>
#include <algorithm>
#include <iostream>

class Acumulador {
public:
    void operator()(int x) {
        soma_ += x;
        ++contagem_;
    }
    double media() const {
        return contagem_ == 0 ? 0.0 : static_cast<double>(soma_) / contagem_;
    }
private:
    long soma_ = 0;
    int contagem_ = 0;
};

void exemplo() {
    std::vector<int> v = {10, 20, 30, 40};
    Acumulador acc = std::for_each(v.begin(), v.end(), Acumulador());
    std::cout << acc.media() << "\n";
}` }
    ]
  },
go: {
    easy: [
      { title: "Olá mundo", code: `package main

import "fmt"

func main() {
    fmt.Println("Olá, mundo!")
}` },
      { title: "Laço com soma", code: `package main

import "fmt"

func main() {
    soma := 0
    for i := 1; i <= 10; i++ {
        soma += i
    }
    fmt.Println("Total:", soma)
}` },
      { title: "Função fatorial", code: `package main

func fatorial(n int) int {
    if n <= 1 {
        return 1
    }
    return n * fatorial(n-1)
}` },
      { title: "Slice e append", code: `package main

import "fmt"

func main() {
    nums := []int{2, 4, 6}
    nums = append(nums, 8, 10)
    for _, v := range nums {
        fmt.Print(v, " ")
    }
}` },
      { title: "Mapa de contagem", code: `package main

import "fmt"

func main() {
    contagem := map[string]int{}
    palavras := []string{"go", "go", "rust"}
    for _, p := range palavras {
        contagem[p]++
    }
    fmt.Println(contagem)
}` }
    ],
    medium: [
      { title: "Goroutines + channel", code: `package main

import (
    "fmt"
    "sync"
)

func main() {
    var wg sync.WaitGroup
    resultados := make(chan int, 5)
    for i := 1; i <= 5; i++ {
        wg.Add(1)
        go func(n int) {
            defer wg.Done()
            resultados <- n * n
        }(i)
    }
    wg.Wait()
    close(resultados)
    for r := range resultados {
        fmt.Println(r)
    }
}` },
      { title: "Tratamento de erro", code: `package main

import (
    "errors"
    "fmt"
)

func dividir(a, b float64) (float64, error) {
    if b == 0 {
        return 0, errors.New("divisão por zero")
    }
    return a / b, nil
}

func main() {
    res, err := dividir(10, 0)
    if err != nil {
        fmt.Println("erro:", err)
        return
    }
    fmt.Println(res)
}` },
      { title: "Struct com método", code: `package main

import "fmt"

type Retangulo struct {
    largura, altura float64
}

func (r Retangulo) Area() float64 {
    return r.largura * r.altura
}

func main() {
    r := Retangulo{largura: 3, altura: 4}
    fmt.Printf("Área: %.2f\n", r.Area())
}` },
      { title: "Interface e polimorfismo", code: `package main

import "fmt"

type Forma interface {
    Area() float64
}

type Circulo struct {
    raio float64
}

func (c Circulo) Area() float64 {
    return 3.14159 * c.raio * c.raio
}

func imprimir(f Forma) {
    fmt.Printf("%.2f\n", f.Area())
}

func main() {
    imprimir(Circulo{raio: 2})
}` },
      { title: "Ordenação customizada", code: `package main

import (
    "fmt"
    "sort"
)

func main() {
    nomes := []string{"Caio", "Ana", "Bruno"}
    sort.Slice(nomes, func(i, j int) bool {
        return len(nomes[i]) < len(nomes[j])
    })
    fmt.Println(nomes)
}` }
    ],
    hard: [
      { title: "Worker pool", code: `package main

import (
    "fmt"
    "sync"
)

func worker(id int, jobs <-chan int, results chan<- int, wg *sync.WaitGroup) {
    defer wg.Done()
    for j := range jobs {
        results <- j * 2
    }
}

func main() {
    jobs := make(chan int, 100)
    results := make(chan int, 100)
    var wg sync.WaitGroup
    for w := 1; w <= 3; w++ {
        wg.Add(1)
        go worker(w, jobs, results, &wg)
    }
    for j := 1; j <= 9; j++ {
        jobs <- j
    }
    close(jobs)
    wg.Wait()
    close(results)
    total := 0
    for r := range results {
        total += r
    }
    fmt.Println("Soma:", total)
}` },
      { title: "Servidor HTTP", code: `package main

import (
    "encoding/json"
    "log"
    "net/http"
)

type Resposta struct {
    Mensagem string \`json:"mensagem"\`
    Status   int    \`json:"status"\`
}

func handler(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    resp := Resposta{Mensagem: "ok", Status: 200}
    json.NewEncoder(w).Encode(resp)
}

func main() {
    http.HandleFunc("/api", handler)
    log.Println("Servindo na porta 8080")
    log.Fatal(http.ListenAndServe(":8080", nil))
}` },
      { title: "Select com timeout", code: `package main

import (
    "fmt"
    "time"
)

func buscar(ch chan<- string) {
    time.Sleep(100 * time.Millisecond)
    ch <- "dados carregados"
}

func main() {
    ch := make(chan string, 1)
    go buscar(ch)
    select {
    case msg := <-ch:
        fmt.Println("recebido:", msg)
    case <-time.After(50 * time.Millisecond):
        fmt.Println("timeout: operação lenta")
    }
}` },
      { title: "Mutex e contador", code: `package main

import (
    "fmt"
    "sync"
)

type Contador struct {
    mu    sync.Mutex
    valor int
}

func (c *Contador) Incrementar() {
    c.mu.Lock()
    defer c.mu.Unlock()
    c.valor++
}

func main() {
    c := &Contador{}
    var wg sync.WaitGroup
    for i := 0; i < 1000; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            c.Incrementar()
        }()
    }
    wg.Wait()
    fmt.Println("Valor final:", c.valor)
}` },
      { title: "Generics com restrição", code: `package main

import "fmt"

type Numero interface {
    ~int | ~float64
}

func SomarTudo[T Numero](valores []T) T {
    var total T
    for _, v := range valores {
        total += v
    }
    return total
}

func Mapear[T, U any](in []T, fn func(T) U) []U {
    out := make([]U, len(in))
    for i, v := range in {
        out[i] = fn(v)
    }
    return out
}

func main() {
    fmt.Println(SomarTudo([]int{1, 2, 3, 4}))
    dobro := Mapear([]int{1, 2, 3}, func(n int) int { return n * 2 })
    fmt.Println(dobro)
}` }
    ]
  },
  rust: {
    easy: [
      { title: "Olá mundo", code: `fn main() {
    println!("Olá, mundo!");
}` },
      { title: "Laço com soma", code: `fn main() {
    let mut soma = 0;
    for i in 1..=10 {
        soma += i;
    }
    println!("Total: {}", soma);
}` },
      { title: "Função quadrado", code: `fn quadrado(n: i32) -> i32 {
    n * n
}

fn main() {
    println!("{}", quadrado(7));
}` },
      { title: "Vetor e iteração", code: `fn main() {
    let nums = vec![2, 4, 6, 8];
    let dobro: Vec<i32> = nums.iter().map(|x| x * 2).collect();
    println!("{:?}", dobro);
}` },
      { title: "Match em enum", code: `enum Cor {
    Vermelho,
    Verde,
    Azul,
}

fn nome(c: Cor) -> &'static str {
    match c {
        Cor::Vermelho => "vermelho",
        Cor::Verde => "verde",
        Cor::Azul => "azul",
    }
}` }
    ],
    medium: [
      { title: "Option e if let", code: `fn primeiro_par(nums: &[i32]) -> Option<i32> {
    for &n in nums {
        if n % 2 == 0 {
            return Some(n);
        }
    }
    None
}

fn main() {
    let dados = [1, 3, 5, 8, 9];
    if let Some(p) = primeiro_par(&dados) {
        println!("Primeiro par: {}", p);
    } else {
        println!("Nenhum par encontrado");
    }
}` },
      { title: "Result com erro", code: `use std::num::ParseIntError;

fn dobrar(texto: &str) -> Result<i32, ParseIntError> {
    let n = texto.parse::<i32>()?;
    Ok(n * 2)
}

fn main() {
    match dobrar("21") {
        Ok(v) => println!("Resultado: {}", v),
        Err(e) => println!("Erro: {}", e),
    }
}` },
      { title: "Struct com impl", code: `struct Ponto {
    x: f64,
    y: f64,
}

impl Ponto {
    fn nova(x: f64, y: f64) -> Self {
        Ponto { x, y }
    }

    fn distancia(&self) -> f64 {
        (self.x * self.x + self.y * self.y).sqrt()
    }
}

fn main() {
    let p = Ponto::nova(3.0, 4.0);
    println!("{}", p.distancia());
}` },
      { title: "Iterador com filter", code: `fn main() {
    let numeros = vec![1, 2, 3, 4, 5, 6, 7, 8];
    let soma_pares: i32 = numeros
        .iter()
        .filter(|&&x| x % 2 == 0)
        .map(|&x| x * x)
        .sum();
    println!("Soma dos quadrados pares: {}", soma_pares);
}` },
      { title: "HashMap e entry", code: `use std::collections::HashMap;

fn main() {
    let texto = "a b a c b a";
    let mut contagem: HashMap<&str, i32> = HashMap::new();
    for palavra in texto.split_whitespace() {
        *contagem.entry(palavra).or_insert(0) += 1;
    }
    let mut pares: Vec<_> = contagem.iter().collect();
    pares.sort();
    println!("{:?}", pares);
}` }
    ],
    hard: [
      { title: "Trait + generics", code: `use std::fmt::Display;

trait Resumir {
    fn resumo(&self) -> String;
}

struct Artigo {
    titulo: String,
    autor: String,
}

impl Resumir for Artigo {
    fn resumo(&self) -> String {
        format!("{} por {}", self.titulo, self.autor)
    }
}

fn anunciar<T: Resumir + Display>(item: &T) {
    println!("Novidade: {} ({})", item.resumo(), item);
}

impl Display for Artigo {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(f, "{}", self.titulo)
    }
}

fn main() {
    let a = Artigo {
        titulo: String::from("Rust"),
        autor: String::from("Caio"),
    };
    anunciar(&a);
}` },
      { title: "Threads e Arc<Mutex>", code: `use std::sync::{Arc, Mutex};
use std::thread;

fn main() {
    let contador = Arc::new(Mutex::new(0));
    let mut handles = vec![];

    for _ in 0..10 {
        let c = Arc::clone(&contador);
        let h = thread::spawn(move || {
            let mut num = c.lock().unwrap();
            *num += 1;
        });
        handles.push(h);
    }

    for h in handles {
        h.join().unwrap();
    }

    println!("Total: {}", *contador.lock().unwrap());
}` },
      { title: "Enum com impl e match", code: `enum Operacao {
    Soma(f64, f64),
    Sub(f64, f64),
    Mul(f64, f64),
    Div(f64, f64),
}

impl Operacao {
    fn calcular(&self) -> Result<f64, String> {
        match self {
            Operacao::Soma(a, b) => Ok(a + b),
            Operacao::Sub(a, b) => Ok(a - b),
            Operacao::Mul(a, b) => Ok(a * b),
            Operacao::Div(_, b) if *b == 0.0 => Err("divisão por zero".to_string()),
            Operacao::Div(a, b) => Ok(a / b),
        }
    }
}

fn main() {
    let ops = vec![Operacao::Soma(2.0, 3.0), Operacao::Div(10.0, 0.0)];
    for op in &ops {
        match op.calcular() {
            Ok(r) => println!("= {}", r),
            Err(e) => println!("erro: {}", e),
        }
    }
}` },
      { title: "Closures e ordenação", code: `#[derive(Debug)]
struct Pessoa {
    nome: String,
    idade: u32,
}

fn main() {
    let mut pessoas = vec![
        Pessoa { nome: String::from("Ana"), idade: 30 },
        Pessoa { nome: String::from("Bruno"), idade: 25 },
        Pessoa { nome: String::from("Caio"), idade: 35 },
    ];

    pessoas.sort_by(|a, b| a.idade.cmp(&b.idade));

    let media: f64 = pessoas.iter().map(|p| p.idade as f64).sum::<f64>()
        / pessoas.len() as f64;

    for p in &pessoas {
        println!("{} tem {} anos", p.nome, p.idade);
    }
    println!("Idade média: {:.1}", media);
}` },
      { title: "Generic com trait bound", code: `use std::ops::Add;

#[derive(Debug, Clone, Copy)]
struct Vetor2D<T> {
    x: T,
    y: T,
}

impl<T: Add<Output = T> + Copy> Vetor2D<T> {
    fn somar(&self, outro: &Vetor2D<T>) -> Vetor2D<T> {
        Vetor2D {
            x: self.x + outro.x,
            y: self.y + outro.y,
        }
    }
}

fn main() {
    let a = Vetor2D { x: 1, y: 2 };
    let b = Vetor2D { x: 3, y: 4 };
    let c = a.somar(&b);
    println!("{:?}", c);
}` }
    ]
  },
  sql: {
    easy: [
      { title: "SELECT com filtro", code: `SELECT nome, email
FROM usuarios
WHERE ativo = true
ORDER BY nome ASC;` },
      { title: "Contagem por status", code: `SELECT status, COUNT(*) AS total
FROM pedidos
GROUP BY status
ORDER BY total DESC;` },
      { title: "Inserção de registro", code: `INSERT INTO produtos (nome, preco, estoque)
VALUES ('Teclado', 199.90, 50),
       ('Mouse', 89.50, 120);` },
      { title: "Atualização condicional", code: `UPDATE pedidos
SET status = 'enviado',
    atualizado_em = NOW()
WHERE status = 'pago'
  AND criado_em < CURRENT_DATE;` },
      { title: "Filtro com intervalo", code: `SELECT id, valor, criado_em
FROM transacoes
WHERE valor BETWEEN 100 AND 500
  AND criado_em >= '2026-01-01'
ORDER BY valor DESC;` }
    ],
    medium: [
      { title: "JOIN com agregação", code: `SELECT u.nome, COUNT(p.id) AS total_pedidos, SUM(p.valor) AS gasto
FROM usuarios u
JOIN pedidos p ON p.usuario_id = u.id
WHERE p.status = 'pago'
GROUP BY u.id, u.nome
HAVING SUM(p.valor) > 1000
ORDER BY gasto DESC;` },
      { title: "LEFT JOIN com COALESCE", code: `SELECT c.nome, COALESCE(SUM(v.total), 0) AS faturamento
FROM clientes c
LEFT JOIN vendas v ON v.cliente_id = c.id
GROUP BY c.id, c.nome
ORDER BY faturamento DESC
LIMIT 10;` },
      { title: "Subconsulta com IN", code: `SELECT nome, email
FROM usuarios
WHERE id IN (
    SELECT DISTINCT usuario_id
    FROM pedidos
    WHERE valor > 500
      AND status = 'pago'
)
ORDER BY nome;` },
      { title: "CASE com agregação", code: `SELECT
    categoria,
    COUNT(*) AS total,
    SUM(CASE WHEN preco > 100 THEN 1 ELSE 0 END) AS caros,
    AVG(preco) AS preco_medio
FROM produtos
GROUP BY categoria
ORDER BY total DESC;` },
      { title: "GROUP BY com data", code: `SELECT
    DATE_TRUNC('month', criado_em) AS mes,
    COUNT(*) AS pedidos,
    SUM(valor) AS receita
FROM pedidos
WHERE status = 'pago'
GROUP BY DATE_TRUNC('month', criado_em)
ORDER BY mes;` }
    ],
    hard: [
      { title: "CTE com window function", code: `WITH ranking_vendas AS (
    SELECT
        v.vendedor_id,
        v.regiao,
        SUM(v.total) AS total_regiao,
        RANK() OVER (
            PARTITION BY v.regiao
            ORDER BY SUM(v.total) DESC
        ) AS posicao
    FROM vendas v
    WHERE v.criado_em >= '2026-01-01'
    GROUP BY v.vendedor_id, v.regiao
)
SELECT vendedor_id, regiao, total_regiao, posicao
FROM ranking_vendas
WHERE posicao <= 3
ORDER BY regiao, posicao;` },
      { title: "Média móvel com OVER", code: `SELECT
    dia,
    receita,
    AVG(receita) OVER (
        ORDER BY dia
        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ) AS media_movel_7d,
    SUM(receita) OVER (
        ORDER BY dia
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS receita_acumulada
FROM receitas_diarias
ORDER BY dia;` },
      { title: "CTE recursiva hierárquica", code: `WITH RECURSIVE subordinados AS (
    SELECT id, nome, gerente_id, 1 AS nivel
    FROM funcionarios
    WHERE gerente_id IS NULL

    UNION ALL

    SELECT f.id, f.nome, f.gerente_id, s.nivel + 1
    FROM funcionarios f
    JOIN subordinados s ON f.gerente_id = s.id
)
SELECT id, nome, nivel
FROM subordinados
ORDER BY nivel, nome;` },
      { title: "LAG para variação", code: `WITH receita_mensal AS (
    SELECT
        DATE_TRUNC('month', criado_em) AS mes,
        SUM(valor) AS receita
    FROM pedidos
    WHERE status = 'pago'
    GROUP BY DATE_TRUNC('month', criado_em)
)
SELECT
    mes,
    receita,
    LAG(receita) OVER (ORDER BY mes) AS mes_anterior,
    ROUND(
        100.0 * (receita - LAG(receita) OVER (ORDER BY mes))
        / NULLIF(LAG(receita) OVER (ORDER BY mes), 0),
        2
    ) AS variacao_pct
FROM receita_mensal
ORDER BY mes;` },
      { title: "Upsert com índice", code: `CREATE TABLE IF NOT EXISTS metricas (
    chave TEXT PRIMARY KEY,
    valor BIGINT NOT NULL DEFAULT 0,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO metricas (chave, valor)
VALUES ('visitas', 1)
ON CONFLICT (chave)
DO UPDATE SET
    valor = metricas.valor + EXCLUDED.valor,
    atualizado_em = NOW();

SELECT chave, valor, atualizado_em
FROM metricas
WHERE chave = 'visitas';` }
    ]
  },
bash: {
    easy: [
      { title: "Olá mundo", code: `#!/usr/bin/env bash
name="World"
echo "Hello, $name!"
echo "Today is $(date +%A)"` },
      { title: "Loop numérico", code: `#!/usr/bin/env bash
for i in 1 2 3 4 5; do
  echo "Contagem: $i"
done` },
      { title: "Condicional simples", code: `#!/usr/bin/env bash
count=10
if [ "$count" -gt 5 ]; then
  echo "Maior que cinco"
else
  echo "Cinco ou menos"
fi` },
      { title: "Variáveis e soma", code: `#!/usr/bin/env bash
a=7
b=3
sum=$((a + b))
echo "A soma de $a e $b vale $sum"` },
      { title: "Lista de frutas", code: `#!/usr/bin/env bash
fruits=("maçã" "banana" "uva")
for fruit in "\${fruits[@]}"; do
  echo "Fruta: $fruit"
done` }
    ],
    medium: [
      { title: "Função com retorno", code: `#!/usr/bin/env bash
greet() {
  local name="$1"
  if [ -z "$name" ]; then
    name="visitante"
  fi
  echo "Bem-vindo, $name"
}

greet "Ana"
greet` },
      { title: "Loop sobre arquivos", code: `#!/usr/bin/env bash
dir="\${1:-.}"
total=0
for file in "$dir"/*.txt; do
  [ -e "$file" ] || continue
  lines=$(wc -l < "$file")
  echo "$file possui $lines linhas"
  total=$((total + lines))
done
echo "Total de linhas: $total"` },
      { title: "Leitura linha a linha", code: `#!/usr/bin/env bash
input="\${1:-dados.txt}"
count=0
while IFS= read -r line; do
  count=$((count + 1))
  echo "$count: $line"
done < "$input"
echo "Lidas $count linhas no total"` },
      { title: "Case com menu", code: `#!/usr/bin/env bash
read -rp "Escolha [a/b/c]: " opt
case "$opt" in
  a) echo "Opção A selecionada" ;;
  b) echo "Opção B selecionada" ;;
  c) echo "Opção C selecionada" ;;
  *) echo "Opção inválida" ;;
esac` },
      { title: "Backup com timestamp", code: `#!/usr/bin/env bash
src="$1"
if [ ! -f "$src" ]; then
  echo "Arquivo não encontrado: $src" >&2
  exit 1
fi
stamp=$(date +%Y%m%d_%H%M%S)
cp "$src" "\${src}.\${stamp}.bak"
echo "Backup criado: \${src}.\${stamp}.bak"` }
    ],
    hard: [
      { title: "Parser de argumentos", code: `#!/usr/bin/env bash
set -euo pipefail

verbose=0
output=""
while getopts ":vo:h" opt; do
  case "$opt" in
    v) verbose=1 ;;
    o) output="$OPTARG" ;;
    h) echo "Uso: $0 [-v] [-o arquivo]"; exit 0 ;;
    \\?) echo "Opção inválida: -$OPTARG" >&2; exit 1 ;;
    :) echo "Faltou argumento para -$OPTARG" >&2; exit 1 ;;
  esac
done

if [ "$verbose" -eq 1 ]; then
  echo "Modo verboso ativado"
fi
echo "Saída: \${output:-stdout}"` },
      { title: "Trap e limpeza", code: `#!/usr/bin/env bash
set -euo pipefail

tmpdir=$(mktemp -d)
cleanup() {
  rm -rf "$tmpdir"
  echo "Diretório temporário removido"
}
trap cleanup EXIT INT TERM

echo "Trabalhando em $tmpdir"
for i in $(seq 1 3); do
  echo "linha $i" > "\${tmpdir}/file_\${i}.txt"
done
count=$(find "$tmpdir" -type f | wc -l)
echo "Criados $count arquivos"` },
      { title: "Tentativas com recuo", code: `#!/usr/bin/env bash
set -euo pipefail

retry() {
  local max="$1"; shift
  local delay=1
  local attempt=1
  until "$@"; do
    if [ "$attempt" -ge "$max" ]; then
      echo "Falhou após $attempt tentativas" >&2
      return 1
    fi
    echo "Tentativa $attempt falhou, aguardando \${delay}s"
    sleep "$delay"
    attempt=$((attempt + 1))
    delay=$((delay * 2))
  done
}

retry 4 curl -fsS https://example.com -o /dev/null
echo "Requisição concluída"` },
      { title: "Contagem de palavras", code: `#!/usr/bin/env bash
set -euo pipefail

declare -A freq
file="\${1:?Informe um arquivo}"

while read -r word; do
  word="\${word,,}"
  word="\${word//[^a-z]/}"
  [ -n "$word" ] || continue
  freq["$word"]=$(( \${freq["$word"]:-0} + 1 ))
done < <(tr ' ' '\\n' < "$file")

for key in "\${!freq[@]}"; do
  echo "\${freq[$key]} $key"
done | sort -rn | head -10` },
      { title: "Verificação de saúde", code: `#!/usr/bin/env bash
set -euo pipefail

services=("nginx" "postgres" "redis")
failed=()

check_service() {
  local name="$1"
  if systemctl is-active --quiet "$name"; then
    echo "[OK] $name está ativo"
    return 0
  fi
  echo "[FALHA] $name está inativo" >&2
  return 1
}

for svc in "\${services[@]}"; do
  check_service "$svc" || failed+=("$svc")
done

if [ "\${#failed[@]}" -gt 0 ]; then
  echo "Serviços com problema: \${failed[*]}"
  exit 1
fi
echo "Todos os serviços operacionais"` }
    ]
  },
  ruby: {
    easy: [
      { title: "Saudação simples", code: `name = "Mundo"
puts "Olá, #{name}!"
puts "O tamanho do nome é #{name.length}"` },
      { title: "Iterar sobre vetor", code: `numbers = [1, 2, 3, 4, 5]
numbers.each do |n|
  puts "Valor: #{n}"
end
puts "Soma: #{numbers.sum}"` },
      { title: "Condicional par ou ímpar", code: `n = 42
if n.even?
  puts "#{n} é par"
else
  puts "#{n} é ímpar"
end` },
      { title: "Mapa de quadrados", code: `squares = (1..5).map { |x| x * x }
puts squares.inspect
puts "Total: #{squares.sum}"` },
      { title: "Hash básico", code: `person = { nome: "Ana", idade: 30 }
person.each do |key, value|
  puts "#{key}: #{value}"
end` }
    ],
    medium: [
      { title: "Bloco com yield", code: `def repeat(times)
  result = []
  times.times do |i|
    result << yield(i)
  end
  result
end

squared = repeat(5) { |n| n * n }
puts squared.inspect` },
      { title: "Array funcional", code: `words = %w[banana maçã uva pera abacaxi]

result = words
  .select { |w| w.length > 3 }
  .map(&:upcase)
  .sort

puts result.join(", ")
puts "Total filtrado: #{result.size}"` },
      { title: "Contador com hash", code: `text = "o rato roeu a roupa do rei de roma"

freq = Hash.new(0)
text.split.each do |word|
  freq[word] += 1
end

freq.sort_by { |_, count| -count }.each do |word, count|
  puts "#{word}: #{count}"
end` },
      { title: "Classe Retângulo", code: `class Rectangle
  attr_reader :width, :height

  def initialize(width, height)
    @width = width
    @height = height
  end

  def area
    width * height
  end

  def to_s
    "Retângulo #{width}x#{height} (área #{area})"
  end
end

puts Rectangle.new(4, 6)` },
      { title: "Leitura de arquivo", code: `total = 0
File.foreach("dados.txt") do |line|
  line.strip!
  next if line.empty?
  total += line.to_i
end

puts "Soma das linhas: #{total}"` }
    ],
    hard: [
      { title: "Módulo Comparable", code: `class Version
  include Comparable
  attr_reader :major, :minor, :patch

  def initialize(str)
    @major, @minor, @patch = str.split(".").map(&:to_i)
  end

  def <=>(other)
    [major, minor, patch] <=> [other.major, other.minor, other.patch]
  end

  def to_s
    "#{major}.#{minor}.#{patch}"
  end
end

versions = ["1.2.0", "1.10.1", "1.2.3"].map { |v| Version.new(v) }
puts versions.sort.map(&:to_s).join(" < ")` },
      { title: "Memoização Fibonacci", code: `class Fibonacci
  def initialize
    @cache = { 0 => 0, 1 => 1 }
  end

  def compute(n)
    raise ArgumentError, "n deve ser >= 0" if n.negative?
    @cache[n] ||= compute(n - 1) + compute(n - 2)
  end
end

fib = Fibonacci.new
(0..10).each do |i|
  print "#{fib.compute(i)} "
end
puts` },
      { title: "Tratamento de exceções", code: `class BankAccount
  class InsufficientFunds < StandardError; end

  attr_reader :balance

  def initialize(balance = 0)
    @balance = balance
  end

  def withdraw(amount)
    raise InsufficientFunds, "Saldo insuficiente" if amount > @balance
    @balance -= amount
    @balance
  end
end

account = BankAccount.new(100)
begin
  account.withdraw(150)
rescue BankAccount::InsufficientFunds => e
  puts "Erro: #{e.message}"
ensure
  puts "Saldo atual: #{account.balance}"
end` },
      { title: "Enumerable customizado", code: `class NumberCollection
  include Enumerable

  def initialize(*numbers)
    @numbers = numbers
  end

  def each(&block)
    @numbers.each(&block)
  end
end

collection = NumberCollection.new(3, 1, 4, 1, 5, 9, 2, 6)
puts "Máximo: #{collection.max}"
puts "Pares: #{collection.select(&:even?).inspect}"
puts "Ordenado: #{collection.sort.inspect}"
puts "Soma: #{collection.reduce(:+)}"` },
      { title: "Struct e agrupamento", code: `Employee = Struct.new(:name, :department, :salary) do
  def annual
    salary * 12
  end
end

staff = [
  Employee.new("Ana", "TI", 8000),
  Employee.new("Bruno", "RH", 6000),
  Employee.new("Carla", "TI", 9000)
]

by_dept = staff.group_by(&:department)
by_dept.each do |dept, people|
  total = people.sum(&:salary)
  puts "#{dept}: #{people.size} pessoas, folha #{total}"
end` }
    ]
  },
  php: {
    easy: [
      { title: "Eco com variável", code: `<?php
$name = "Mundo";
echo "Olá, $name!\\n";
echo "Tamanho: " . strlen($name) . "\\n";` },
      { title: "Laço for", code: `<?php
for ($i = 1; $i <= 5; $i++) {
    echo "Número: $i\\n";
}` },
      { title: "Condicional if/else", code: `<?php
$age = 20;
if ($age >= 18) {
    echo "Maior de idade\\n";
} else {
    echo "Menor de idade\\n";
}` },
      { title: "Array indexado", code: `<?php
$fruits = ["maçã", "banana", "uva"];
foreach ($fruits as $index => $fruit) {
    echo "$index => $fruit\\n";
}` },
      { title: "Função de soma", code: `<?php
function soma(int $a, int $b): int {
    return $a + $b;
}

echo soma(7, 3) . "\\n";` }
    ],
    medium: [
      { title: "Array associativo", code: `<?php
$prices = [
    "café" => 5.50,
    "pão" => 0.75,
    "leite" => 4.20,
];

$total = 0.0;
foreach ($prices as $item => $price) {
    printf("%-8s R$ %.2f\\n", $item, $price);
    $total += $price;
}
printf("Total: R$ %.2f\\n", $total);` },
      { title: "Filtro e mapa", code: `<?php
$numbers = range(1, 10);

$evens = array_filter($numbers, fn($n) => $n % 2 === 0);
$doubled = array_map(fn($n) => $n * 2, $evens);

echo implode(", ", $doubled) . "\\n";
echo "Soma: " . array_sum($doubled) . "\\n";` },
      { title: "Manipulação de string", code: `<?php
$phrase = "  o rato roeu a roupa  ";
$clean = trim($phrase);
$words = explode(" ", $clean);

$capitalized = array_map("ucfirst", $words);
echo implode(" ", $capitalized) . "\\n";
echo "Palavras: " . count($words) . "\\n";` },
      { title: "Classe Produto", code: `<?php
class Product {
    public function __construct(
        public string $name,
        public float $price
    ) {}

    public function withTax(float $rate): float {
        return $this->price * (1 + $rate);
    }
}

$p = new Product("Teclado", 150.0);
printf("%s com imposto: R$ %.2f\\n", $p->name, $p->withTax(0.1));` },
      { title: "Leitura de arquivo", code: `<?php
$path = $argv[1] ?? "dados.txt";
$lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

$total = 0;
foreach ($lines as $line) {
    $total += (int) $line;
}

echo "Linhas: " . count($lines) . "\\n";
echo "Soma: $total\\n";` }
    ],
    hard: [
      { title: "Interface e polimorfismo", code: `<?php
interface Shape {
    public function area(): float;
}

class Circle implements Shape {
    public function __construct(private float $radius) {}

    public function area(): float {
        return M_PI * $this->radius ** 2;
    }
}

class Square implements Shape {
    public function __construct(private float $side) {}

    public function area(): float {
        return $this->side ** 2;
    }
}

$shapes = [new Circle(3), new Square(4)];
foreach ($shapes as $shape) {
    printf("%s: %.2f\\n", get_class($shape), $shape->area());
}` },
      { title: "Tratamento de exceções", code: `<?php
class DivisionException extends Exception {}

function divide(float $a, float $b): float {
    if ($b === 0.0) {
        throw new DivisionException("Divisão por zero");
    }
    return $a / $b;
}

$pairs = [[10, 2], [5, 0], [9, 3]];
foreach ($pairs as [$a, $b]) {
    try {
        $result = divide($a, $b);
        printf("%g / %g = %g\\n", $a, $b, $result);
    } catch (DivisionException $e) {
        echo "Erro: " . $e->getMessage() . "\\n";
    }
}` },
      { title: "Agrupamento de dados", code: `<?php
$people = [
    ["name" => "Ana", "city" => "SP"],
    ["name" => "Bruno", "city" => "RJ"],
    ["name" => "Carla", "city" => "SP"],
    ["name" => "Diego", "city" => "RJ"],
];

$grouped = [];
foreach ($people as $person) {
    $grouped[$person["city"]][] = $person["name"];
}

foreach ($grouped as $city => $names) {
    echo "$city (" . count($names) . "): " . implode(", ", $names) . "\\n";
}` },
      { title: "Trait reutilizável", code: `<?php
trait Loggable {
    private array $logs = [];

    public function log(string $message): void {
        $this->logs[] = "[" . date("H:i:s") . "] $message";
    }

    public function dumpLogs(): void {
        foreach ($this->logs as $entry) {
            echo $entry . "\\n";
        }
    }
}

class Service {
    use Loggable;

    public function run(): void {
        $this->log("Serviço iniciado");
        $this->log("Processando dados");
        $this->log("Serviço finalizado");
    }
}

$service = new Service();
$service->run();
$service->dumpLogs();` },
      { title: "Gerador de sequência", code: `<?php
function fibonacci(int $limit): Generator {
    [$a, $b] = [0, 1];
    while ($a < $limit) {
        yield $a;
        [$a, $b] = [$b, $a + $b];
    }
}

$sum = 0;
foreach (fibonacci(100) as $value) {
    echo "$value ";
    $sum += $value;
}
echo "\\nSoma: $sum\\n";` }
    ]
  },
kotlin: {
    easy: [
      { title: "Soma de lista", code: `fun somaLista(numeros: List<Int>): Int {
    var total = 0
    for (n in numeros) {
        total += n
    }
    return total
}` },
      { title: "Número par", code: `fun ehPar(numero: Int): Boolean {
    return numero % 2 == 0
}

fun main() {
    println(ehPar(10))
    println(ehPar(7))
}` },
      { title: "Fatorial recursivo", code: `fun fatorial(n: Int): Long {
    if (n <= 1) return 1
    return n * fatorial(n - 1)
}` },
      { title: "Maior valor", code: `fun maior(a: Int, b: Int): Int {
    return if (a > b) a else b
}

fun main() {
    println(maior(42, 17))
}` },
      { title: "Contagem regressiva", code: `fun contagem(inicio: Int) {
    var i = inicio
    while (i > 0) {
        println(i)
        i--
    }
    println("Fim")
}` }
    ],
    medium: [
      { title: "Data class", code: `data class Usuario(
    val id: Int,
    val nome: String,
    val ativo: Boolean
)

fun main() {
    val u = Usuario(1, "Caio", true)
    val copia = u.copy(ativo = false)
    println(copia)
}` },
      { title: "Filtrar e mapear", code: `fun nomesAtivos(usuarios: List<Usuario>): List<String> {
    return usuarios
        .filter { it.ativo }
        .map { it.nome.uppercase() }
        .sorted()
}

data class Usuario(val nome: String, val ativo: Boolean)` },
      { title: "Agrupar por chave", code: `fun agruparPorTamanho(palavras: List<String>): Map<Int, List<String>> {
    return palavras.groupBy { it.length }
}

fun main() {
    val palavras = listOf("oi", "rua", "sol", "mar", "casa")
    val grupos = agruparPorTamanho(palavras)
    grupos.forEach { (tamanho, lista) ->
        println("\$tamanho: \$lista")
    }
}` },
      { title: "Extensão de String", code: `fun String.ehPalindromo(): Boolean {
    val limpo = this.lowercase().filter { it.isLetter() }
    return limpo == limpo.reversed()
}

fun main() {
    println("Ame a ema".ehPalindromo())
    println("Kotlin".ehPalindromo())
}` },
      { title: "Reduce e média", code: `fun media(notas: List<Double>): Double {
    if (notas.isEmpty()) return 0.0
    val soma = notas.reduce { acc, nota -> acc + nota }
    return soma / notas.size
}

fun main() {
    val notas = listOf(7.5, 8.0, 6.5, 9.0)
    println("Média: \${media(notas)}")
}` }
    ],
    hard: [
      { title: "Sealed class resultado", code: `sealed class Resultado<out T> {
    data class Sucesso<T>(val dado: T) : Resultado<T>()
    data class Erro(val mensagem: String) : Resultado<Nothing>()
}

fun dividir(a: Int, b: Int): Resultado<Int> {
    return if (b == 0) {
        Resultado.Erro("Divisão por zero")
    } else {
        Resultado.Sucesso(a / b)
    }
}

fun main() {
    when (val r = dividir(10, 2)) {
        is Resultado.Sucesso -> println("Valor: \${r.dado}")
        is Resultado.Erro -> println("Falha: \${r.mensagem}")
    }
}` },
      { title: "Coroutine async", code: `import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay

suspend fun buscarPreco(id: Int): Int {
    delay(100)
    return id * 10
}

suspend fun totalCarrinho(ids: List<Int>): Int = coroutineScope {
    val precos = ids.map { id ->
        async { buscarPreco(id) }
    }
    precos.sumOf { it.await() }
}` },
      { title: "Enum com propriedades", code: `enum class Planeta(val massa: Double, val raio: Double) {
    TERRA(5.976e24, 6.378e6),
    MARTE(6.421e23, 3.397e6),
    JUPITER(1.9e27, 7.149e7);

    val gravidade: Double
        get() = 6.67300e-11 * massa / (raio * raio)
}

fun main() {
    for (p in Planeta.values()) {
        println("\${p.name}: \${p.gravidade}")
    }
}` },
      { title: "Interface genérica", code: `interface Repositorio<T, ID> {
    fun salvar(item: T): T
    fun buscarPorId(id: ID): T?
    fun listarTodos(): List<T>
}

class MemoriaRepo<T> : Repositorio<T, Int> {
    private val dados = mutableMapOf<Int, T>()
    private var sequencia = 0

    override fun salvar(item: T): T {
        dados[++sequencia] = item
        return item
    }

    override fun buscarPorId(id: Int): T? = dados[id]

    override fun listarTodos(): List<T> = dados.values.toList()
}` },
      { title: "Função de extensão genérica", code: `fun <T> List<T>.particionar(predicado: (T) -> Boolean): Pair<List<T>, List<T>> {
    val verdadeiros = mutableListOf<T>()
    val falsos = mutableListOf<T>()
    for (item in this) {
        if (predicado(item)) {
            verdadeiros.add(item)
        } else {
            falsos.add(item)
        }
    }
    return Pair(verdadeiros, falsos)
}

fun main() {
    val numeros = (1..10).toList()
    val (pares, impares) = numeros.particionar { it % 2 == 0 }
    println("Pares: \$pares")
    println("Ímpares: \$impares")
}` }
    ]
  },
  swift: {
    easy: [
      { title: "Soma de array", code: `func soma(_ numeros: [Int]) -> Int {
    var total = 0
    for n in numeros {
        total += n
    }
    return total
}` },
      { title: "Verifica primo", code: `func ehPrimo(_ n: Int) -> Bool {
    if n < 2 { return false }
    for i in 2..<n {
        if n % i == 0 { return false }
    }
    return true
}` },
      { title: "Saudação", code: `func saudacao(nome: String) -> String {
    return "Olá, \\(nome)!"
}

print(saudacao(nome: "Caio"))
print(saudacao(nome: "Ana"))` },
      { title: "Inverter string", code: `func inverter(_ texto: String) -> String {
    return String(texto.reversed())
}

print(inverter("CodeRacer"))` },
      { title: "Dobro dos itens", code: `let numeros = [1, 2, 3, 4, 5]
let dobrados = numeros.map { $0 * 2 }
print(dobrados)
let pares = numeros.filter { $0 % 2 == 0 }
print(pares)` }
    ],
    medium: [
      { title: "Struct com método", code: `struct Retangulo {
    let largura: Double
    let altura: Double

    var area: Double {
        return largura * altura
    }

    func cabe(em outro: Retangulo) -> Bool {
        return largura <= outro.largura && altura <= outro.altura
    }
}

let r = Retangulo(largura: 3, altura: 4)
print(r.area)` },
      { title: "Optional binding", code: `func parseIdade(_ texto: String) -> String {
    if let idade = Int(texto), idade >= 0 {
        return "Idade válida: \\(idade)"
    } else {
        return "Entrada inválida"
    }
}

print(parseIdade("28"))
print(parseIdade("abc"))` },
      { title: "Reduce somatório", code: `let precos = [9.99, 4.50, 12.00, 3.25]
let total = precos.reduce(0, +)
let formatado = String(format: "%.2f", total)
print("Total: R$ \\(formatado)")

let acima = precos.filter { $0 > 5 }
print("Itens caros: \\(acima.count)")` },
      { title: "Extensão de Array", code: `extension Array where Element == Int {
    func somaPares() -> Int {
        return self.filter { $0 % 2 == 0 }
                   .reduce(0, +)
    }
}

let valores = [1, 2, 3, 4, 5, 6]
print(valores.somaPares())` },
      { title: "Dicionário de contagem", code: `func contarLetras(_ texto: String) -> [Character: Int] {
    var contagem: [Character: Int] = [:]
    for letra in texto where letra != " " {
        contagem[letra, default: 0] += 1
    }
    return contagem
}

let resultado = contarLetras("banana")
print(resultado)` }
    ],
    hard: [
      { title: "Enum com associados", code: `enum Operacao {
    case soma(Int, Int)
    case subtracao(Int, Int)
    case negacao(Int)

    func calcular() -> Int {
        switch self {
        case let .soma(a, b):
            return a + b
        case let .subtracao(a, b):
            return a - b
        case let .negacao(a):
            return -a
        }
    }
}

let ops: [Operacao] = [.soma(3, 4), .subtracao(10, 2), .negacao(5)]
for op in ops {
    print(op.calcular())
}` },
      { title: "Protocolo com extensão", code: `protocol Forma {
    var area: Double { get }
    var nome: String { get }
}

extension Forma {
    func descricao() -> String {
        return "\\(nome) com área \\(area)"
    }
}

struct Circulo: Forma {
    let raio: Double
    var nome: String { "Círculo" }
    var area: Double { Double.pi * raio * raio }
}

let c = Circulo(raio: 2.0)
print(c.descricao())` },
      { title: "Generics com restrição", code: `func maiorElemento<T: Comparable>(_ itens: [T]) -> T? {
    guard var maximo = itens.first else {
        return nil
    }
    for item in itens.dropFirst() {
        if item > maximo {
            maximo = item
        }
    }
    return maximo
}

let numeros = [3, 9, 1, 7, 4]
if let m = maiorElemento(numeros) {
    print("Maior: \\(m)")
}

let palavras = ["pera", "uva", "maçã"]
print(maiorElemento(palavras) ?? "vazio")` },
      { title: "Closure async", code: `func buscarUsuario(id: Int, completar: @escaping (Result<String, Error>) -> Void) {
    DispatchQueue.global().asyncAfter(deadline: .now() + 0.1) {
        if id > 0 {
            completar(.success("Usuário \\(id)"))
        } else {
            completar(.failure(NSError(domain: "App", code: 400)))
        }
    }
}

buscarUsuario(id: 42) { resultado in
    switch resultado {
    case .success(let nome):
        print(nome)
    case .failure(let erro):
        print("Erro: \\(erro)")
    }
}` },
      { title: "Property wrapper", code: `@propertyWrapper
struct Limitado {
    private var valor: Int
    private let minimo: Int
    private let maximo: Int

    init(wrappedValue: Int, _ minimo: Int, _ maximo: Int) {
        self.minimo = minimo
        self.maximo = maximo
        self.valor = max(minimo, min(maximo, wrappedValue))
    }

    var wrappedValue: Int {
        get { valor }
        set { valor = max(minimo, min(maximo, newValue)) }
    }
}

struct Configuracao {
    @Limitado(0, 100) var volume: Int = 50
}

var config = Configuracao()
config.volume = 150
print(config.volume)` }
    ]
  },
  lua: {
    easy: [
      { title: "Soma de lista", code: `function somaLista(numeros)
    local total = 0
    for _, n in ipairs(numeros) do
        total = total + n
    end
    return total
end` },
      { title: "Número par", code: `function ehPar(n)
    return n % 2 == 0
end

print(ehPar(10))
print(ehPar(7))` },
      { title: "Maior valor", code: `function maior(a, b)
    if a > b then
        return a
    end
    return b
end` }
    ],
    medium: [
      { title: "Fatorial recursivo", code: `function fatorial(n)
    if n <= 1 then
        return 1
    end
    return n * fatorial(n - 1)
end

print(fatorial(5))` },
      { title: "FizzBuzz", code: `for i = 1, 20 do
    if i % 15 == 0 then
        print("FizzBuzz")
    elseif i % 3 == 0 then
        print("Fizz")
    elseif i % 5 == 0 then
        print("Buzz")
    else
        print(i)
    end
end` },
      { title: "Contar palavras", code: `function contarPalavras(texto)
    local contador = {}
    for palavra in string.gmatch(texto, "%a+") do
        contador[palavra] = (contador[palavra] or 0) + 1
    end
    return contador
end` }
    ],
    hard: [
      { title: "Pilha com metatable", code: `local Pilha = {}
Pilha.__index = Pilha

function Pilha.nova()
    return setmetatable({ itens = {} }, Pilha)
end

function Pilha:empilhar(valor)
    table.insert(self.itens, valor)
end

function Pilha:desempilhar()
    return table.remove(self.itens)
end

function Pilha:vazia()
    return #self.itens == 0
end` },
      { title: "Filtrar pares", code: `function filtrar(lista, predicado)
    local resultado = {}
    for _, valor in ipairs(lista) do
        if predicado(valor) then
            resultado[#resultado + 1] = valor
        end
    end
    return resultado
end

local numeros = { 1, 2, 3, 4, 5, 6 }
local pares = filtrar(numeros, function(n)
    return n % 2 == 0
end)` },
      { title: "Memoização Fibonacci", code: `local function criarFib()
    local cache = { [0] = 0, [1] = 1 }
    local function fib(n)
        if cache[n] then
            return cache[n]
        end
        cache[n] = fib(n - 1) + fib(n - 2)
        return cache[n]
    end
    return fib
end

local fib = criarFib()
print(fib(10))` }
    ]
  },
  dart: {
    easy: [
      { title: "Soma de lista", code: `int somaLista(List<int> numeros) {
  var total = 0;
  for (final n in numeros) {
    total += n;
  }
  return total;
}` },
      { title: "Número par", code: `bool ehPar(int n) {
  return n % 2 == 0;
}

void main() {
  print(ehPar(10));
  print(ehPar(7));
}` },
      { title: "Saudação", code: `String saudacao(String nome) {
  return "Ola, " + nome + "!";
}` }
    ],
    medium: [
      { title: "Fatorial recursivo", code: `int fatorial(int n) {
  if (n <= 1) {
    return 1;
  }
  return n * fatorial(n - 1);
}

void main() {
  print(fatorial(5));
}` },
      { title: "Filtrar pares", code: `List<int> filtrarPares(List<int> numeros) {
  return numeros.where((n) => n % 2 == 0).toList();
}

void main() {
  final resultado = filtrarPares([1, 2, 3, 4, 5, 6]);
  print(resultado);
}` },
      { title: "Contar palavras", code: `Map<String, int> contarPalavras(String texto) {
  final contador = <String, int>{};
  for (final palavra in texto.split(" ")) {
    contador[palavra] = (contador[palavra] ?? 0) + 1;
  }
  return contador;
}` }
    ],
    hard: [
      { title: "Classe Ponto", code: `class Ponto {
  final double x;
  final double y;

  const Ponto(this.x, this.y);

  double distancia(Ponto outro) {
    final dx = x - outro.x;
    final dy = y - outro.y;
    return sqrt(dx * dx + dy * dy);
  }

  @override
  String toString() => "Ponto(" + x.toString() + ", " + y.toString() + ")";
}` },
      { title: "Busca assíncrona", code: `Future<int> buscarTotal(List<int> ids) async {
  var total = 0;
  for (final id in ids) {
    await Future.delayed(Duration(milliseconds: 10));
    total += id;
  }
  return total;
}` },
      { title: "Primeiro que satisfaz", code: `T primeiroOnde<T>(List<T> lista, bool Function(T) teste) {
  for (final item in lista) {
    if (teste(item)) {
      return item;
    }
  }
  throw StateError("Nenhum elemento encontrado");
}

void main() {
  final numeros = [1, 3, 5, 8, 9];
  print(primeiroOnde(numeros, (n) => n % 2 == 0));
}` }
    ]
  },
  scala: {
    easy: [
      { title: "Soma de lista", code: `def somaLista(numeros: List[Int]): Int = {
    var total = 0
    for (n <- numeros) {
        total += n
    }
    total
}` },
      { title: "Número par", code: `def ehPar(n: Int): Boolean = {
    n % 2 == 0
}` },
      { title: "Dobrar valores", code: `def dobrar(numeros: List[Int]): List[Int] = {
    numeros.map(n => n * 2)
}` }
    ],
    medium: [
      { title: "Fatorial recursivo", code: `def fatorial(n: Int): Int = {
    if (n <= 1) 1
    else n * fatorial(n - 1)
}

println(fatorial(5))` },
      { title: "Filtrar pares", code: `def filtrarPares(numeros: List[Int]): List[Int] = {
    numeros.filter(n => n % 2 == 0)
}

val resultado = filtrarPares(List(1, 2, 3, 4, 5, 6))
println(resultado)` },
      { title: "FizzBuzz", code: `for (i <- 1 to 20) {
    val saida =
        if (i % 15 == 0) "FizzBuzz"
        else if (i % 3 == 0) "Fizz"
        else if (i % 5 == 0) "Buzz"
        else i.toString
    println(saida)
}` }
    ],
    hard: [
      { title: "Área com pattern matching", code: `sealed trait Forma
case class Circulo(raio: Double) extends Forma
case class Retangulo(largura: Double, altura: Double) extends Forma

def area(forma: Forma): Double = forma match {
    case Circulo(raio) => math.Pi * raio * raio
    case Retangulo(largura, altura) => largura * altura
}

val formas = List(Circulo(2.0), Retangulo(3.0, 4.0))
formas.foreach(f => println(area(f)))` },
      { title: "Contar palavras", code: `def contarPalavras(texto: String): Map[String, Int] = {
    texto
        .split("\\\\s+")
        .groupBy(palavra => palavra)
        .map { case (palavra, ocorrencias) => (palavra, ocorrencias.length) }
}` },
      { title: "Divisão segura", code: `def dividir(a: Int, b: Int): Option[Double] = {
    if (b == 0) None
    else Some(a.toDouble / b)
}

val entradas = List((10, 2), (5, 0), (9, 3))
entradas.foreach { case (a, b) =>
    dividir(a, b) match {
        case Some(valor) => println("Resultado: " + valor)
        case None => println("Divisao por zero")
    }
}` }
    ]
  },
  elixir: {
    easy: [
      { title: "Soma de lista", code: `defmodule Lista do
  def soma(numeros) do
    Enum.sum(numeros)
  end
end` },
      { title: "Dobro com map", code: `defmodule Dobro do
  def dobrar(numeros) do
    Enum.map(numeros, fn x -> x * 2 end)
  end
end` },
      { title: "Filtrar pares", code: `defmodule Pares do
  def filtrar(numeros) do
    Enum.filter(numeros, fn x -> rem(x, 2) == 0 end)
  end
end` }
    ],
    medium: [
      { title: "Fatorial recursivo", code: `defmodule Matematica do
  def fatorial(0), do: 1
  def fatorial(n) when n > 0 do
    n * fatorial(n - 1)
  end

  def potencia(_base, 0), do: 1
  def potencia(base, exp) when exp > 0 do
    base * potencia(base, exp - 1)
  end
end` },
      { title: "FizzBuzz", code: `defmodule FizzBuzz do
  def jogar(limite) do
    Enum.map(1..limite, &classificar/1)
  end

  defp classificar(n) when rem(n, 15) == 0, do: "FizzBuzz"
  defp classificar(n) when rem(n, 3) == 0, do: "Fizz"
  defp classificar(n) when rem(n, 5) == 0, do: "Buzz"
  defp classificar(n), do: Integer.to_string(n)
end` },
      { title: "Contar palavras", code: `defmodule Contador do
  def contar(texto) do
    texto
    |> String.downcase()
    |> String.split(~r/\\s+/, trim: true)
    |> Enum.frequencies()
    |> Enum.sort_by(fn {_palavra, freq} -> -freq end)
  end
end` }
    ],
    hard: [
      { title: "GenServer contador", code: `defmodule Contador do
  use GenServer

  def start_link(inicial \\\\ 0) do
    GenServer.start_link(__MODULE__, inicial, name: __MODULE__)
  end

  def incrementar(valor \\\\ 1) do
    GenServer.cast(__MODULE__, {:incrementar, valor})
  end

  def total, do: GenServer.call(__MODULE__, :total)

  @impl true
  def init(inicial), do: {:ok, inicial}

  @impl true
  def handle_cast({:incrementar, valor}, estado) do
    {:noreply, estado + valor}
  end

  @impl true
  def handle_call(:total, _from, estado) do
    {:reply, estado, estado}
  end
end` },
      { title: "Quicksort", code: `defmodule Ordenacao do
  def quicksort([]), do: []

  def quicksort([pivo | resto]) do
    menores = for x <- resto, x < pivo, do: x
    maiores = for x <- resto, x >= pivo, do: x
    quicksort(menores) ++ [pivo] ++ quicksort(maiores)
  end
end` },
      { title: "Soma com acumulador", code: `defmodule Reduce do
  def soma_total(numeros) do
    percorrer(numeros, 0)
  end

  defp percorrer([], acc), do: acc
  defp percorrer([cabeca | cauda], acc) do
    percorrer(cauda, acc + cabeca)
  end

  def maximo([primeiro | resto]) do
    Enum.reduce(resto, primeiro, fn x, atual ->
      if x > atual, do: x, else: atual
    end)
  end
end` }
    ]
  },
  erlang: {
    easy: [
      { title: "Soma de lista", code: `-module(lista).
-export([soma/1]).

soma(Numeros) ->
    lists:sum(Numeros).` },
      { title: "Dobro com map", code: `-module(dobro).
-export([dobrar/1]).

dobrar(Numeros) ->
    lists:map(fun(X) -> X * 2 end, Numeros).` },
      { title: "Filtrar pares", code: `-module(pares).
-export([filtrar/1]).

filtrar(Numeros) ->
    lists:filter(fun(X) -> X rem 2 =:= 0 end, Numeros).` }
    ],
    medium: [
      { title: "Fatorial recursivo", code: `-module(matematica).
-export([fatorial/1, potencia/2]).

fatorial(0) -> 1;
fatorial(N) when N > 0 ->
    N * fatorial(N - 1).

potencia(_Base, 0) -> 1;
potencia(Base, Exp) when Exp > 0 ->
    Base * potencia(Base, Exp - 1).` },
      { title: "FizzBuzz", code: `-module(fizzbuzz).
-export([jogar/1, classificar/1]).

jogar(Limite) ->
    [classificar(N) || N <- lists:seq(1, Limite)].

classificar(N) when N rem 15 =:= 0 -> "FizzBuzz";
classificar(N) when N rem 3 =:= 0 -> "Fizz";
classificar(N) when N rem 5 =:= 0 -> "Buzz";
classificar(N) -> integer_to_list(N).` },
      { title: "Reverter lista", code: `-module(reverter).
-export([inverter/1]).

inverter(Lista) ->
    inverter(Lista, []).

inverter([], Acc) ->
    Acc;
inverter([Cabeca | Cauda], Acc) ->
    inverter(Cauda, [Cabeca | Acc]).` }
    ],
    hard: [
      { title: "GenServer contador", code: `-module(contador).
-behaviour(gen_server).

-export([start_link/0, incrementar/1, total/0]).
-export([init/1, handle_call/3, handle_cast/2]).

start_link() ->
    gen_server:start_link({local, ?MODULE}, ?MODULE, 0, []).

incrementar(Valor) ->
    gen_server:cast(?MODULE, {incrementar, Valor}).

total() ->
    gen_server:call(?MODULE, total).

init(Inicial) ->
    {ok, Inicial}.

handle_cast({incrementar, Valor}, Estado) ->
    {noreply, Estado + Valor}.

handle_call(total, _From, Estado) ->
    {reply, Estado, Estado}.` },
      { title: "Quicksort", code: `-module(ordenacao).
-export([quicksort/1]).

quicksort([]) ->
    [];
quicksort([Pivo | Resto]) ->
    Menores = [X || X <- Resto, X < Pivo],
    Maiores = [X || X <- Resto, X >= Pivo],
    quicksort(Menores) ++ [Pivo] ++ quicksort(Maiores).` },
      { title: "Servidor de eco", code: `-module(eco).
-export([iniciar/0, laco/0]).

iniciar() ->
    spawn(?MODULE, laco, []).

laco() ->
    receive
        {De, {mensagem, Texto}} ->
            De ! {self(), {resposta, Texto}},
            laco();
        parar ->
            ok
    after 5000 ->
        timeout
    end.` }
    ]
  },
  haskell: {
    easy: [
      { title: "Soma de lista", code: `soma :: [Int] -> Int
soma = foldr (+) 0` },
      { title: "Dobro com map", code: `dobrar :: [Int] -> [Int]
dobrar = map (\\x -> x * 2)` },
      { title: "Filtrar pares", code: `filtrarPares :: [Int] -> [Int]
filtrarPares = filter even` }
    ],
    medium: [
      { title: "Fatorial recursivo", code: `fatorial :: Integer -> Integer
fatorial 0 = 1
fatorial n = n * fatorial (n - 1)

potencia :: Integer -> Integer -> Integer
potencia _ 0 = 1
potencia base expo = base * potencia base (expo - 1)` },
      { title: "FizzBuzz", code: `fizzbuzz :: Int -> String
fizzbuzz n
  | n \`mod\` 15 == 0 = "FizzBuzz"
  | n \`mod\` 3 == 0  = "Fizz"
  | n \`mod\` 5 == 0  = "Buzz"
  | otherwise       = show n

jogar :: Int -> [String]
jogar limite = map fizzbuzz [1 .. limite]` },
      { title: "Reverter lista", code: `reverter :: [a] -> [a]
reverter = foldl (\\acc x -> x : acc) []

quicksort :: Ord a => [a] -> [a]
quicksort [] = []
quicksort (pivo:resto) =
  quicksort menores ++ [pivo] ++ quicksort maiores
  where
    menores = filter (< pivo) resto
    maiores = filter (>= pivo) resto` }
    ],
    hard: [
      { title: "Fibonacci preguiçoso", code: `fibonacci :: [Integer]
fibonacci = 0 : 1 : zipWith (+) fibonacci (tail fibonacci)

nesimo :: Int -> Integer
nesimo n = fibonacci !! n

somaPares :: Int -> Integer
somaPares limite =
  sum (filter even (take limite fibonacci))` },
      { title: "Árvore binária", code: `data Arvore a = Folha | No (Arvore a) a (Arvore a)

inserir :: Ord a => a -> Arvore a -> Arvore a
inserir x Folha = No Folha x Folha
inserir x arvore@(No esq valor dir)
  | x < valor = No (inserir x esq) valor dir
  | x > valor = No esq valor (inserir x dir)
  | otherwise = arvore

emOrdem :: Arvore a -> [a]
emOrdem Folha = []
emOrdem (No esq valor dir) =
  emOrdem esq ++ [valor] ++ emOrdem dir` },
      { title: "Contar palavras", code: `import Data.List (sortBy, group, sort)
import Data.Ord (comparing, Down(..))
import Data.Char (toLower)

contar :: String -> [(String, Int)]
contar texto =
  sortBy (comparing (Down . snd)) frequencias
  where
    palavras = words (map toLower texto)
    frequencias =
      map (\\ps -> (head ps, length ps)) (group (sort palavras))` }
    ]
  },
  julia: {
    easy: [
      { title: "Soma de vetor", code: `function soma_vetor(v)
    return sum(v)
end

println(soma_vetor([1, 2, 3, 4, 5]))` },
      { title: "Fatorial recursivo", code: `function fatorial(n)
    n <= 1 && return 1
    return n * fatorial(n - 1)
end

println(fatorial(5))` },
      { title: "Média", code: `function media(v)
    return sum(v) / length(v)
end

println(media([10, 20, 30]))` }
    ],
    medium: [
      { title: "Filtrar pares", code: `function pares(numeros)
    return filter(iseven, numeros)
end

lista = 1:10
resultado = pares(collect(lista))
soma = sum(resultado)
println("Pares: ", resultado)
println("Soma: ", soma)` },
      { title: "FizzBuzz", code: `function fizzbuzz(n)
    for i in 1:n
        if i % 15 == 0
            println("FizzBuzz")
        elseif i % 3 == 0
            println("Fizz")
        elseif i % 5 == 0
            println("Buzz")
        else
            println(i)
        end
    end
end

fizzbuzz(15)` },
      { title: "Fibonacci", code: `function fibonacci(n)
    a, b = 0, 1
    for _ in 1:n
        a, b = b, a + b
    end
    return a
end

sequencia = [fibonacci(i) for i in 0:9]
println("Fibonacci: ", sequencia)` }
    ],
    hard: [
      { title: "Área por dispatch", code: `abstract type Forma end

struct Circulo <: Forma
    raio::Float64
end

struct Retangulo <: Forma
    largura::Float64
    altura::Float64
end

area(c::Circulo) = pi * c.raio^2
area(r::Retangulo) = r.largura * r.altura

formas = [Circulo(2.0), Retangulo(3.0, 4.0)]
total = sum(area, formas)
println("Area total: ", round(total, digits=2))` },
      { title: "Normalizar amostra", code: `function normalizar(dados::Vector{Float64})
    media = sum(dados) / length(dados)
    desvio = sqrt(sum((x - media)^2 for x in dados) / length(dados))
    return [(x - media) / desvio for x in dados]
end

amostra = [1.0, 2.0, 3.0, 4.0, 5.0]
z = normalizar(amostra)
println("Z-scores: ", round.(z, digits=2))` },
      { title: "Ponto mais distante", code: `struct Ponto
    x::Float64
    y::Float64
end

distancia(a::Ponto, b::Ponto) = sqrt((a.x - b.x)^2 + (a.y - b.y)^2)

pontos = [Ponto(0.0, 0.0), Ponto(3.0, 4.0), Ponto(6.0, 8.0)]
origem = Ponto(0.0, 0.0)
dists = [distancia(origem, p) for p in pontos]
mais_longe = pontos[argmax(dists)]

println("Distancias: ", round.(dists, digits=1))
println("Mais longe: ", mais_longe)` }
    ]
  },
  clojure: {
    easy: [
      { title: "Soma de lista", code: `(defn soma-lista [nums]
  (reduce + nums))

(println (soma-lista [1 2 3 4 5]))` },
      { title: "Fatorial recursivo", code: `(defn fatorial [n]
  (if (<= n 1)
    1
    (* n (fatorial (dec n)))))

(println (fatorial 5))` },
      { title: "Quadrados", code: `(defn quadrados [nums]
  (map #(* % %) nums))

(println (quadrados [1 2 3 4]))` }
    ],
    medium: [
      { title: "Somar pares", code: `(defn soma-pares [nums]
  (->> nums
       (filter even?)
       (reduce +)))

(def numeros (range 1 11))
(println "Pares somados:" (soma-pares numeros))
(println "Todos:" (vec numeros))` },
      { title: "FizzBuzz", code: `(defn fizzbuzz [n]
  (doseq [i (range 1 (inc n))]
    (println
      (cond
        (zero? (mod i 15)) "FizzBuzz"
        (zero? (mod i 3))  "Fizz"
        (zero? (mod i 5))  "Buzz"
        :else i))))

(fizzbuzz 15)` },
      { title: "Contar palavras", code: `(defn contar-palavras [texto]
  (->> (clojure.string/split texto #"\\s+")
       (map clojure.string/lower-case)
       frequencies))

(def frase "o rato roeu a roupa o rato")
(println (contar-palavras frase))` }
    ],
    hard: [
      { title: "Valor do estoque", code: `(defrecord Produto [nome preco quantidade])

(defn valor-total [p]
  (* (:preco p) (:quantidade p)))

(def estoque
  [(->Produto "Cafe" 15.0 3)
   (->Produto "Pao" 8.0 10)
   (->Produto "Leite" 6.0 5)])

(def total
  (->> estoque
       (map valor-total)
       (reduce +)))

(println "Valor do estoque:" total)` },
      { title: "Quadrados ímpares", code: `(defn processar [nums]
  (->> nums
       (filter odd?)
       (map #(* % %))
       (take 5)
       (reduce +)))

(def resultado
  (-> (range 1 100)
      processar))

(println "Soma dos quadrados impares:" resultado)` },
      { title: "Agrupar por paridade", code: `(defn agrupar-por-paridade [nums]
  (reduce
    (fn [acc n]
      (let [chave (if (even? n) :pares :impares)]
        (update acc chave conj n)))
    {:pares [] :impares []}
    nums))

(def dados (range 1 11))
(def grupos (agrupar-por-paridade dados))
(println "Pares:" (:pares grupos))
(println "Impares:" (:impares grupos))` }
    ]
  },
  fortran: {
    easy: [
      { title: "Soma de vetor", code: `program soma_vetor
  implicit none
  integer :: v(5) = [1, 2, 3, 4, 5]
  print *, 'Soma:', sum(v)
end program soma_vetor` },
      { title: "Fatorial", code: `integer function fatorial(n)
  implicit none
  integer, intent(in) :: n
  integer :: i
  fatorial = 1
  do i = 2, n
    fatorial = fatorial * i
  end do
end function fatorial` },
      { title: "Média", code: `real function media(x, n)
  implicit none
  integer, intent(in) :: n
  real, intent(in) :: x(n)
  media = sum(x) / real(n)
end function media` }
    ],
    medium: [
      { title: "Maior valor", code: `program maior_valor
  implicit none
  integer :: v(6) = [3, 9, 1, 7, 4, 8]
  integer :: i, maior
  maior = v(1)
  do i = 2, size(v)
    if (v(i) > maior) then
      maior = v(i)
    end if
  end do
  print *, 'Maior:', maior
end program maior_valor` },
      { title: "Fibonacci", code: `program fibonacci
  implicit none
  integer :: i, n, a, b, temp
  n = 10
  a = 0
  b = 1
  do i = 1, n
    print *, a
    temp = a + b
    a = b
    b = temp
  end do
end program fibonacci` },
      { title: "Contar pares", code: `program contar_pares
  implicit none
  integer :: v(8) = [4, 7, 2, 9, 6, 3, 8, 1]
  integer :: i, pares
  pares = 0
  do i = 1, size(v)
    if (mod(v(i), 2) == 0) pares = pares + 1
  end do
  print *, 'Pares:', pares
end program contar_pares` }
    ],
    hard: [
      { title: "Módulo estatística", code: `module estatistica
  implicit none
contains
  real function media(x, n)
    integer, intent(in) :: n
    real, intent(in) :: x(n)
    media = sum(x) / real(n)
  end function media

  real function desvio(x, n)
    integer, intent(in) :: n
    real, intent(in) :: x(n)
    real :: m
    m = media(x, n)
    desvio = sqrt(sum((x - m)**2) / real(n))
  end function desvio
end module estatistica

program main
  use estatistica
  implicit none
  real :: dados(5) = [2.0, 4.0, 4.0, 4.0, 6.0]
  print *, 'Media:', media(dados, 5)
  print *, 'Desvio:', desvio(dados, 5)
end program main` },
      { title: "Crivo de Eratóstenes", code: `program crivo
  implicit none
  integer, parameter :: n = 30
  logical :: primo(n)
  integer :: i, j
  primo = .true.
  primo(1) = .false.
  do i = 2, int(sqrt(real(n)))
    if (primo(i)) then
      do j = i * i, n, i
        primo(j) = .false.
      end do
    end if
  end do
  do i = 1, n
    if (primo(i)) print *, i
  end do
end program crivo` },
      { title: "Ordenação bolha", code: `program bolha
  implicit none
  integer :: v(6) = [5, 2, 8, 1, 9, 3]
  integer :: i, j, temp
  do i = 1, size(v) - 1
    do j = 1, size(v) - i
      if (v(j) > v(j + 1)) then
        temp = v(j)
        v(j) = v(j + 1)
        v(j + 1) = temp
      end if
    end do
  end do
  print *, v
end program bolha` }
    ]
  },
  cobol: {
    easy: [
      { title: "Olá mundo", code: `       PARAGRAFO-PRINCIPAL.
           DISPLAY 'CODERACER EM COBOL'.
           DISPLAY 'DIGITE RAPIDO!'.
           STOP RUN.` },
      { title: "Soma de dois", code: `       SOMAR.
           MOVE 5 TO NUM-A.
           MOVE 7 TO NUM-B.
           ADD NUM-A TO NUM-B GIVING RESULTADO.
           DISPLAY 'SOMA: ' RESULTADO.` },
      { title: "Média", code: `       CALCULAR-MEDIA.
           ADD N1 N2 N3 GIVING SOMA.
           DIVIDE SOMA BY 3 GIVING RESULTADO.
           DISPLAY 'MEDIA: ' RESULTADO.
           STOP RUN.` }
    ],
    medium: [
      { title: "Somador", code: `       IDENTIFICATION DIVISION.
       PROGRAM-ID. SOMADOR.
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01 NUM-A     PIC 999 VALUE 125.
       01 NUM-B     PIC 999 VALUE 250.
       01 TOTAL     PIC 9999.
       PROCEDURE DIVISION.
           ADD NUM-A TO NUM-B GIVING TOTAL.
           DISPLAY 'TOTAL: ' TOTAL.
           STOP RUN.` },
      { title: "Contar até dez", code: `       IDENTIFICATION DIVISION.
       PROGRAM-ID. CONTADOR.
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01 I    PIC 99.
       PROCEDURE DIVISION.
           PERFORM VARYING I FROM 1 BY 1 UNTIL I > 10
               DISPLAY 'NUMERO: ' I
           END-PERFORM.
           STOP RUN.` },
      { title: "Maior de dois", code: `       IDENTIFICATION DIVISION.
       PROGRAM-ID. MAIOR.
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01 A    PIC 99 VALUE 42.
       01 B    PIC 99 VALUE 17.
       PROCEDURE DIVISION.
           IF A > B
               DISPLAY 'MAIOR: ' A
           ELSE
               DISPLAY 'MAIOR: ' B
           END-IF.
           STOP RUN.` }
    ],
    hard: [
      { title: "Fatorial", code: `       IDENTIFICATION DIVISION.
       PROGRAM-ID. FATORIAL.
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01 N          PIC 99 VALUE 5.
       01 I          PIC 99.
       01 RESULTADO  PIC 9(8) VALUE 1.
       PROCEDURE DIVISION.
           PERFORM VARYING I FROM 1 BY 1 UNTIL I > N
               COMPUTE RESULTADO = RESULTADO * I
           END-PERFORM.
           DISPLAY 'FATORIAL DE ' N ' = ' RESULTADO.
           STOP RUN.` },
      { title: "Soma de tabela", code: `       IDENTIFICATION DIVISION.
       PROGRAM-ID. SOMA-TABELA.
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01 TABELA.
          05 NUM     PIC 99 OCCURS 5 TIMES.
       01 I          PIC 99.
       01 TOTAL      PIC 999 VALUE 0.
       PROCEDURE DIVISION.
           MOVE 10 TO NUM(1).
           MOVE 20 TO NUM(2).
           MOVE 30 TO NUM(3).
           MOVE 40 TO NUM(4).
           MOVE 50 TO NUM(5).
           PERFORM VARYING I FROM 1 BY 1 UNTIL I > 5
               ADD NUM(I) TO TOTAL
           END-PERFORM.
           DISPLAY 'SOMA: ' TOTAL.
           STOP RUN.` },
      { title: "FizzBuzz", code: `       IDENTIFICATION DIVISION.
       PROGRAM-ID. FIZZBUZZ.
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01 I    PIC 99.
       PROCEDURE DIVISION.
           PERFORM VARYING I FROM 1 BY 1 UNTIL I > 15
               EVALUATE TRUE
                   WHEN FUNCTION MOD(I, 15) = 0
                       DISPLAY 'FIZZBUZZ'
                   WHEN FUNCTION MOD(I, 3) = 0
                       DISPLAY 'FIZZ'
                   WHEN FUNCTION MOD(I, 5) = 0
                       DISPLAY 'BUZZ'
                   WHEN OTHER
                       DISPLAY I
               END-EVALUATE
           END-PERFORM.
           STOP RUN.` }
    ]
  },
};

function normalizeLang(l: string): string {
  const m = String(l || "").toLowerCase();
  if (m === "ts") return "typescript";
  if (m === "js") return "javascript";
  if (m === "py") return "python";
  if (m === "c++" || m === "cplusplus") return "cpp";
  if (m === "c#" || m === "cs") return "csharp";
  return m;
}

export interface PickedSnippet {
  title: string;
  code: string;
  language: LangId;
  difficulty: Difficulty;
}

/**
 * Escolhe o bucket de onde sortear: a dificuldade pedida, depois medium/easy da
 * mesma linguagem, depois a mesma cadeia em javascript.
 *
 * A seleção é por `.length`, não por truthiness: `[]` é *truthy*, então a cadeia
 * de `||` anterior atravessava um bucket presente-porém-vazio e devolvia
 * `undefined` do sorteio — `TypeError` em `choice.title`. Nenhum bucket real está
 * vazio hoje (`snippets.test.ts` versiona os 72 como invariante), mas o caminho
 * existia.
 */
function resolvePool(lang: string, diff: Difficulty): SnippetSeed[] {
  for (const bucket of [SNIPPETS[lang], SNIPPETS.javascript]) {
    if (!bucket) continue;
    const pool = [bucket[diff], bucket.medium, bucket.easy].find(p => p?.length);
    if (pool) return pool;
  }
  return [];
}

/**
 * Sorteia um snippet do pool server-side.
 *
 * `excludeTitle` (#115) tira da urna o título da corrida anterior da sala: a
 * revanche é o loop de retenção do produto, e com buckets de 3–5 snippets o
 * sorteio uniforme repetia o código recém-digitado em 20–33% das vezes — com o
 * WPM já memorizado indo direto ao ranking global. A memória é de UMA partida:
 * A→B→A continua possível, e é aceitável.
 *
 * O 3º parâmetro é opcional para o Treino Livre (`api/snippet/route.ts`) seguir
 * chamando com dois argumentos.
 */
export function pickSnippet(
  language: string,
  difficulty: string,
  excludeTitle?: string | null
): PickedSnippet {
  const lang = normalizeLang(language) || "javascript";
  const diff = (["easy", "medium", "hard"].includes(difficulty) ? difficulty : "medium") as Difficulty;
  const pool = resolvePool(lang, diff);
  if (!pool.length) {
    // Inalcançável enquanto o invariante dos 72 buckets valer; explícito em vez
    // de devolver `undefined` disfarçado de snippet.
    throw new Error(`pickSnippet: nenhum snippet disponível para ${lang}/${diff}`);
  }
  // A exclusão é por título, e o eixo da degradação é o pool JÁ FILTRADO, não o
  // tamanho do bucket: bucket de 1 — ou títulos repetidos dentro do bucket —
  // esvaziaria o filtro. Nesses casos repete em vez de falhar.
  const candidates = excludeTitle ? pool.filter(s => s.title !== excludeTitle) : pool;
  const from = candidates.length ? candidates : pool;
  const choice = from[Math.floor(Math.random() * from.length)];
  return {
    title: choice.title,
    code: choice.code,
    language: lang as LangId,
    difficulty: diff
  };
}
