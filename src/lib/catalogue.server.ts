'use server'

import { supabaseAdmin } from '@/integrations/supabase/client.server'

export interface ProductMatch {
  id: number
  name: string
  price: number
  currency: string
  image_url: string | null
  product_url: string | null
  availability: string
  matchReason: string
}

export interface ProductMatchAttrs {
  color?: string
  category?: string
  style?: string
  fabric?: string
  keywords?: string[]
}

/**
 * Match products from the catalogue by visual attributes extracted from an image.
 * Searches product_catalogue by category ILIKE and/or name/description ILIKE any keyword.
 * Returns top 5 matches.
 */
export async function matchProductsByAttributes(
  attrs: ProductMatchAttrs
): Promise<ProductMatch[]> {
  // Build search terms from all attribute fields
  const searchTerms: string[] = []

  if (attrs.category) searchTerms.push(attrs.category)
  if (attrs.style) searchTerms.push(attrs.style)
  if (attrs.fabric) searchTerms.push(attrs.fabric)
  if (attrs.color) searchTerms.push(attrs.color)
  if (attrs.keywords?.length) searchTerms.push(...attrs.keywords)

  if (searchTerms.length === 0) return []

  // Deduplicate and lowercase
  const terms = [...new Set(searchTerms.map((t) => t.trim().toLowerCase()).filter(Boolean))]

  try {
    // Fetch a wider pool then score client-side to avoid complex OR chains
    // We select all products and filter/rank them. For large catalogues a
    // DB-side full-text search would be better, but this keeps the query simple.
    const { data, error } = await supabaseAdmin
      .from('product_catalogue')
      .select('id, name, description, price, currency, image_url, availability, category, brand')
      .limit(200)

    if (error) {
      console.error('[catalogue] query error:', error.message)
      return []
    }

    if (!data || data.length === 0) return []

    // Score each product by how many search terms appear in name/description/category
    const scored = data
      .map((row: any) => {
        const haystack = [
          row.name ?? '',
          row.description ?? '',
          row.category ?? '',
          row.brand ?? '',
        ]
          .join(' ')
          .toLowerCase()

        let score = 0
        const matchedTerms: string[] = []

        for (const term of terms) {
          if (haystack.includes(term)) {
            score++
            matchedTerms.push(term)
          }
        }

        return { row, score, matchedTerms }
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)

    return scored.map(({ row, matchedTerms }) => ({
      id: row.id,
      name: row.name ?? 'Unknown',
      price: Number(row.price ?? 0),
      currency: row.currency ?? 'BDT',
      image_url: row.image_url ?? null,
      product_url: row.product_url ?? null,
      availability: row.availability ?? 'unknown',
      matchReason: matchedTerms.length > 0 ? `Matched: ${matchedTerms.join(', ')}` : 'General match',
    }))
  } catch (err: any) {
    console.error('[catalogue] matchProductsByAttributes error:', err?.message || err)
    return []
  }
}

/**
 * For out-of-stock matched products, find similar IN-STOCK alternatives.
 * Similarity is scored by shared category + shared attribute terms in the name.
 * Returns up to `limit` in-stock suggestions, excluding the given product ids.
 */
export async function findInStockAlternatives(
  outOfStockProducts: Array<{ id: number; name: string; category?: string }>,
  attrs: ProductMatchAttrs = {},
  limit = 3
): Promise<ProductMatch[]> {
  if (!outOfStockProducts.length) return []

  const excludeIds = new Set(outOfStockProducts.map((p) => p.id))
  // Attribute terms to look for in alternative names/categories
  const attrTerms = [
    attrs.category,
    attrs.style,
    attrs.fabric,
    attrs.color,
    ...(attrs.keywords ?? []),
  ]
    .map((t) => (t ?? '').trim().toLowerCase())
    .filter(Boolean)

  try {
    const { data, error } = await supabaseAdmin
      .from('product_catalogue')
      .select('id, name, description, price, currency, image_url, product_url, availability, category, brand')
      .eq('availability', 'in stock')
      .limit(500)

    if (error) {
      console.error('[catalogue] alternatives query error:', error.message)
      return []
    }
    if (!data || data.length === 0) return []

    // Score candidate alternatives
    const scored = data
      .filter((row: any) => !excludeIds.has(row.id))
      .map((row: any) => {
        const nameLower = (row.name ?? '').toLowerCase()
        const catLower = (row.category ?? '').toLowerCase()
        let score = 0
        const matchedTerms: string[] = []

        // Bonus if same category as an out-of-stock item
        for (const oos of outOfStockProducts) {
          const oosCat = (oos.category ?? '').toLowerCase()
          if (oosCat && catLower === oosCat) score += 3
        }
        // Bonus for shared attribute terms in name/category
        for (const term of attrTerms) {
          if (nameLower.includes(term) || catLower.includes(term)) {
            score += 2
            matchedTerms.push(term)
          }
        }
        return { row, score, matchedTerms }
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)

    return scored.map(({ row, matchedTerms }) => ({
      id: row.id,
      name: row.name ?? 'Unknown',
      price: Number(row.price ?? 0),
      currency: row.currency ?? 'BDT',
      image_url: row.image_url ?? null,
      product_url: row.product_url ?? null,
      availability: row.availability ?? 'in stock',
      matchReason: matchedTerms.length > 0 ? `Similar: ${matchedTerms.join(', ')}` : 'Similar category',
    }))
  } catch (err: any) {
    console.error('[catalogue] findInStockAlternatives error:', err?.message || err)
    return []
  }
}
