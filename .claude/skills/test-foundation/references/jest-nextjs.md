# Testes Jest para Next.js — Padrão do Portfólio

## Contexto

skilldepot tem `__tests__/` com 10 arquivos Jest cobrindo utilitários críticos (`oauth`, `rate-limit`, `semver`, `changelog-diff`, `skill-form-schema`). É o melhor nível de testes do portfólio para web. MecanicaSmart e MedPet não têm nenhum teste — e ambos têm lógica de billing/RLS onde uma regressão custa dinheiro ou vaza dados.

## Setup mínimo (se ainda não existe)

```bash
# Em projetos Next.js 14/15 com TypeScript
pnpm add -D jest @types/jest jest-environment-jsdom ts-jest @testing-library/react @testing-library/jest-dom
```

`jest.config.ts` na raiz do app:
```typescript
import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',           // 'jsdom' para testes de componente
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',  // alias do Next.js
  },
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
}

export default config
```

`jest.setup.ts`:
```typescript
import '@testing-library/jest-dom'
```

`package.json` script:
```json
"scripts": {
  "test": "jest",
  "test:watch": "jest --watch",
  "test:coverage": "jest --coverage"
}
```

## O que testar em cada projeto

### skilldepot — adicionar cobertura em:

**CRIT-001 (SQL injection em `mcp-tools.ts:47`):**
```typescript
// __tests__/mcp-tools.test.ts
describe('search_skills — injeção SQL', () => {
  it('rejeita query com caracteres maliciosos', async () => {
    const malicious = "'; DROP TABLE skills; --"
    await expect(searchSkills(malicious)).rejects.toThrow(/invalid input/)
    // ou verifica que a query usa parametrização, nunca interpolação
  })
})
```

**OAuth token flow:**
```typescript
describe('OAuth — authorization code', () => {
  it('retorna 302 redirect, não JSON com o code', async () => {
    const response = await handleAuthorize(validRequest)
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toContain('code=')
    // garante que CRIT-009 não regride
  })
})
```

### MecanicaSmart — testes de lógica de negócio em `packages/shared/src/`:

```typescript
// packages/shared/__tests__/billing.test.ts
describe('calcularMoedas', () => {
  it('desconto de 20% no plano anual', () => {
    expect(calcularMoedas({ plano: 'anual', quantidade: 100 })).toBe(80)
  })

  it('não aplica desconto em plano mensal', () => {
    expect(calcularMoedas({ plano: 'mensal', quantidade: 100 })).toBe(100)
  })
})
```

```typescript
// packages/shared/__tests__/os.test.ts
describe('validarOS', () => {
  it('OS sem veículo é inválida', () => {
    const result = validarOS({ cliente: 'João', veiculo: null, servicos: [] })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('veículo obrigatório')
  })
})
```

### MedPet/linkapet — testar token de compartilhamento:

```typescript
// __tests__/share-token.test.ts
describe('token de compartilhamento', () => {
  it('token expirado é rejeitado', () => {
    const expired = createToken({ expiresAt: Date.now() - 1000 })
    expect(validateToken(expired)).toEqual({ valid: false, reason: 'expired' })
  })

  it('token com escopo limitado não acessa vacinas se não incluído', () => {
    const token = createToken({ scopes: ['weight'] })
    expect(canAccess(token, 'vaccines')).toBe(false)
  })
})
```

## Padrão de mock para Supabase

Nunca conecte a um Supabase real em testes unitários. Use mock:

```typescript
// __tests__/helpers/supabase-mock.ts
export const createSupabaseMock = (data: unknown = []) => ({
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data, error: null }),
  insert: jest.fn().mockResolvedValue({ data, error: null }),
})

// Uso no teste:
jest.mock('@/lib/supabase', () => ({
  createClient: () => createSupabaseMock(fakePetData),
}))
```

## Padrão de mock para Stripe

```typescript
jest.mock('stripe', () => ({
  default: jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: jest.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/test' }),
      },
    },
  })),
}))
```

## CI snippet

```yaml
- name: Testes Jest
  run: pnpm test --ci --passWithNoTests
  working-directory: ./  # ou apps/web/ em monorepo

- name: Coverage report
  run: pnpm test:coverage
  if: github.event_name == 'pull_request'
```
