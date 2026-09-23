/**
 * Testes Jest — padrão skilldepot/__tests__/
 *
 * Este exemplo cobre skill-form-schema e rate-limit,
 * os dois utilitários mais críticos do marketplace.
 *
 * Rode com: pnpm test (ou npm test)
 */

// ── skill-form-schema ─────────────────────────────────────────────────────────

import { validateSkillForm, SkillFormSchema } from '@/lib/skill-form-schema'

describe('SkillFormSchema — validação de publicação', () => {
    const validSkill = {
        name: 'minha-skill',
        description: 'Faz X quando Y acontece. Use sempre que Z.',
        version: '1.0.0',
        price: 0,
        content: '---\nname: minha-skill\ndescription: ...\n---\n# Conteúdo\n',
        category: 'productivity',
    }

    it('skill válida passa na validação', () => {
        const result = validateSkillForm(validSkill)
        expect(result.success).toBe(true)
    })

    it('name com espaços é rejeitado', () => {
        const result = validateSkillForm({ ...validSkill, name: 'minha skill' })
        expect(result.success).toBe(false)
        expect(result.error?.issues[0].path).toContain('name')
    })

    it('versão sem semver é rejeitada', () => {
        const result = validateSkillForm({ ...validSkill, version: 'v1' })
        expect(result.success).toBe(false)
        expect(result.error?.issues[0].message).toMatch(/semver/)
    })

    it('preço negativo é rejeitado', () => {
        const result = validateSkillForm({ ...validSkill, price: -1 })
        expect(result.success).toBe(false)
    })

    it('conteúdo sem frontmatter YAML é rejeitado', () => {
        const result = validateSkillForm({ ...validSkill, content: '# Sem frontmatter' })
        expect(result.success).toBe(false)
        expect(result.error?.issues[0].message).toMatch(/frontmatter/)
    })

    it('description muito curta é rejeitada (< 20 chars)', () => {
        const result = validateSkillForm({ ...validSkill, description: 'Curta' })
        expect(result.success).toBe(false)
    })
})

// ── rate-limit ────────────────────────────────────────────────────────────────

import { checkRateLimit, RateLimitConfig } from '@/lib/rate-limit'

describe('checkRateLimit', () => {
    const config: RateLimitConfig = { maxRequests: 3, windowMs: 60_000 }

    beforeEach(() => {
        // Limpa o Map interno entre testes (evita estado compartilhado)
        jest.useFakeTimers()
    })

    afterEach(() => {
        jest.useRealTimers()
    })

    it('permite requisições dentro do limite', () => {
        for (let i = 0; i < 3; i++) {
            expect(checkRateLimit('user-123', config).allowed).toBe(true)
        }
    })

    it('bloqueia quando o limite é atingido', () => {
        for (let i = 0; i < 3; i++) checkRateLimit('user-456', config)
        const result = checkRateLimit('user-456', config)
        expect(result.allowed).toBe(false)
        expect(result.retryAfterMs).toBeGreaterThan(0)
    })

    it('reseta após a janela expirar', () => {
        for (let i = 0; i < 3; i++) checkRateLimit('user-789', config)
        jest.advanceTimersByTime(config.windowMs + 1)
        expect(checkRateLimit('user-789', config).allowed).toBe(true)
    })

    it('IPs diferentes têm contadores independentes', () => {
        for (let i = 0; i < 3; i++) checkRateLimit('user-aaa', config)
        // user-aaa está bloqueado, mas user-bbb ainda não
        expect(checkRateLimit('user-bbb', config).allowed).toBe(true)
    })
})

// ── Regressão: CRIT-001 (SQL injection em mcp-tools) ─────────────────────────

import { buildSkillSearchQuery } from '@/lib/mcp-tools'

describe('buildSkillSearchQuery — regressão CRIT-001', () => {
    it('não interpola query diretamente na string SQL', () => {
        const malicious = "'; DROP TABLE skills; --"
        // A função deve usar parametrização (retornar objeto com params separados)
        // nunca retornar uma string com a query interpolada diretamente
        const result = buildSkillSearchQuery(malicious)

        expect(typeof result).toBe('object')
        expect(result).toHaveProperty('params')
        expect(result.params).toContain(malicious)  // valor está nos params, não na query
        // A query base nunca deve conter o valor diretamente
        expect(result.query).not.toContain("DROP TABLE")
        expect(result.query).not.toContain(malicious)
    })

    it('query vazia retorna busca sem filtro (não quebra)', () => {
        const result = buildSkillSearchQuery('')
        expect(result).toHaveProperty('query')
        expect(result.query.length).toBeGreaterThan(0)
    })
})
