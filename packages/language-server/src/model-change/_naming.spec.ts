import { describe, expect, it } from 'vitest'
import { deriveIdentifier, isValidIdentifier } from './_naming'

describe('deriveIdentifier', () => {
  it('UT-020: camelCase from title', () => {
    expect(deriveIdentifier('Billing API', 'service', new Set())).toBe('billingApi')
  })

  it('UT-021: strips diacritics and non-alphanumerics', () => {
    expect(deriveIdentifier('Ação & Cia 2', 'service', new Set())).toBe('acaoCia2')
  })

  it('UT-022: appends numeric suffix when taken', () => {
    expect(deriveIdentifier('Billing API', 'service', new Set(['billingApi', 'billingApi2']))).toBe('billingApi3')
  })

  it('UT-023: falls back to kind when the title has no usable characters', () => {
    expect(deriveIdentifier('???', 'service', new Set())).toBe('service')
    expect(deriveIdentifier('???', 'service', new Set(['service']))).toBe('service2')
  })

  it('falls back to kind when the slug starts with a digit', () => {
    expect(deriveIdentifier('2FA', 'service', new Set())).toBe('service')
  })
})

describe('isValidIdentifier', () => {
  it('matches the grammar identifier', () => {
    expect(isValidIdentifier('billingApi')).toBe(true)
    expect(isValidIdentifier('billing-api_2')).toBe(true)
    expect(isValidIdentifier('_x')).toBe(true)
    expect(isValidIdentifier('billing api')).toBe(false)
    expect(isValidIdentifier('2fa')).toBe(false)
    expect(isValidIdentifier('')).toBe(false)
  })
})
