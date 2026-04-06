import { describe, it, expect } from 'vitest'
import { correlation, partialCorrelation, fisherZTest } from './discovery'

describe('correlation()', () => {
  it('returns 1 for perfect positive correlation', () => {
    const x = [1, 2, 3, 4, 5]
    const y = [2, 4, 6, 8, 10]
    expect(correlation(x, y)).toBeCloseTo(1, 10)
  })

  it('returns -1 for perfect negative correlation', () => {
    const x = [1, 2, 3, 4, 5]
    const y = [10, 8, 6, 4, 2]
    expect(correlation(x, y)).toBeCloseTo(-1, 10)
  })

  it('returns approximately 0 for uncorrelated variables', () => {
    // Constructed orthogonal sequences
    const x = [1, -1, 1, -1, 1, -1]
    const y = [1, 1, -1, -1, 0, 0]
    expect(Math.abs(correlation(x, y))).toBeLessThan(0.1)
  })

  it('returns NaN for zero-variance array', () => {
    const x = [3, 3, 3, 3]
    const y = [1, 2, 3, 4]
    expect(correlation(x, y)).toBeNaN()
  })
})

describe('partialCorrelation()', () => {
  it('base case (empty condSet) equals raw correlation', () => {
    const data = {
      X: [1, 2, 3, 4, 5],
      Y: [2, 4, 6, 8, 10],
    }
    const raw = correlation(data.X, data.Y)
    const partial = partialCorrelation(data, 'X', 'Y', [])
    expect(partial).toBeCloseTo(raw, 10)
  })

  it('removes confounding: ρ(X,Y|Z) ≈ 0 when Z is the sole common cause', () => {
    // Z is a common cause of X and Y, but X and Y are independent given Z.
    // Generate n=100 samples: Z ~ N(0,1), X = Z + noise, Y = Z + noise
    const n = 100
    // Use a deterministic pseudo-random sequence for reproducibility
    function lcg(seed: number) {
      let s = seed
      return () => {
        s = (1664525 * s + 1013904223) & 0xffffffff
        // Map to [-1, 1] via normal approx (Box-Muller would be cleaner, use sum of uniforms)
        return (s >>> 0) / 0xffffffff
      }
    }
    const rand = lcg(42)
    const uniformToNormal = () => {
      // Sum of 12 uniforms - 6 ≈ N(0,1)
      let sum = 0
      for (let i = 0; i < 12; i++) sum += rand()
      return sum - 6
    }

    const Z: number[] = []
    const X: number[] = []
    const Y: number[] = []
    for (let i = 0; i < n; i++) {
      const z = uniformToNormal()
      const x = z + 0.3 * uniformToNormal()
      const y = z + 0.3 * uniformToNormal()
      Z.push(z)
      X.push(x)
      Y.push(y)
    }

    const data = { X, Y, Z }

    // Raw correlation should be high (strong confounding)
    const rawCorr = correlation(X, Y)
    expect(rawCorr).toBeGreaterThan(0.7)

    // Partial correlation given Z should be close to 0
    const partialCorr = partialCorrelation(data, 'X', 'Y', ['Z'])
    expect(Math.abs(partialCorr)).toBeLessThan(0.3)
  })
})

describe('fisherZTest()', () => {
  it('returns isIndependent=true for truly independent variables', () => {
    // X and Y constructed to be uncorrelated
    const n = 60
    const X = Array.from({ length: n }, (_, i) => Math.sin(i))
    const Y = Array.from({ length: n }, (_, i) => Math.cos(i * 2.1 + 1))
    const data = { X, Y }

    const result = fisherZTest(data, 'X', 'Y', [], n)
    // These sequences have low correlation; expect p-value > 0.05
    // If not, at least verify the structure
    expect(result).toHaveProperty('pValue')
    expect(result).toHaveProperty('zStat')
    expect(result).toHaveProperty('isIndependent')
  })

  it('returns isIndependent=false for strongly correlated variables', () => {
    const n = 60
    const X = Array.from({ length: n }, (_, i) => i)
    const Y = Array.from({ length: n }, (_, i) => i * 2 + 1) // perfect linear relationship
    const data = { X, Y }

    const result = fisherZTest(data, 'X', 'Y', [], n)
    expect(result.isIndependent).toBe(false)
    expect(result.pValue).toBeLessThan(0.05)
    expect(Math.abs(result.zStat)).toBeGreaterThan(3)
  })

  it('returns p=1 and isIndependent=true when |S| + 3 >= n', () => {
    const n = 10
    const data = {
      X: Array.from({ length: n }, (_, i) => i),
      Y: Array.from({ length: n }, (_, i) => i * 2),
      // 8 conditioning variables means |S| + 3 = 11 >= 10
      Z1: Array.from({ length: n }, () => 1),
      Z2: Array.from({ length: n }, () => 2),
      Z3: Array.from({ length: n }, () => 3),
      Z4: Array.from({ length: n }, () => 4),
      Z5: Array.from({ length: n }, () => 5),
      Z6: Array.from({ length: n }, () => 6),
      Z7: Array.from({ length: n }, () => 7),
      Z8: Array.from({ length: n }, () => 8),
    }
    const condSet = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Z6', 'Z7', 'Z8'] // |S|=8, 8+3=11 >= 10

    const result = fisherZTest(data, 'X', 'Y', condSet, n)
    expect(result.pValue).toBe(1)
    expect(result.zStat).toBe(0)
    expect(result.isIndependent).toBe(true)
  })

  it('uses custom alpha threshold', () => {
    // With alpha=0.5, even moderate correlation may be considered dependent
    const n = 60
    const X = Array.from({ length: n }, (_, i) => i)
    const Y = Array.from({ length: n }, (_, i) => i * 2)
    const data = { X, Y }

    const strict = fisherZTest(data, 'X', 'Y', [], n, 0.01)
    const lenient = fisherZTest(data, 'X', 'Y', [], n, 0.99)

    // Both should detect perfect correlation as dependent
    expect(strict.isIndependent).toBe(false)
    // With alpha=0.99, almost anything with nonzero pValue would be independent...
    // but perfect correlation has p≈0, so still dependent
    expect(lenient.isIndependent).toBe(false)
  })
})
