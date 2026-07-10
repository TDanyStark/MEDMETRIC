import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/useAuth'
import { listOrgBrands, listManagerBrands } from '@/services/backoffice'
import { listRepMaterialFilters } from '@/services/rep'

export interface BrandOption {
  label: string
  value: string
}

async function fetchAllManagerBrandNames(): Promise<string[]> {
  const names = new Set<string>()
  let page = 1
  let lastPage = 1

  do {
    const result = await listManagerBrands({ page })
    result.items.forEach(item => names.add(item.name))
    lastPage = result.last_page || 1
    page += 1
  } while (page <= lastPage)

  return Array.from(names)
}

/**
 * Returns the list of brand names available to the current user, sourced
 * from the correct endpoint depending on their role. Used to feed the
 * "Producto" select in doctor forms, where the brand name (not id) is
 * stored as free text.
 */
export function useBrandOptions() {
  const { user } = useAuth()
  const role = user?.role

  const query = useQuery({
    queryKey: ['brand-options', role],
    queryFn: async (): Promise<string[]> => {
      if (role === 'org_admin') {
        const result = await listOrgBrands({ all: true })
        return result.items.map(item => item.name)
      }

      if (role === 'manager') {
        return fetchAllManagerBrandNames()
      }

      if (role === 'rep') {
        const filters = await listRepMaterialFilters()
        return filters.brands.map(brand => brand.name)
      }

      return []
    },
    enabled: Boolean(role),
    staleTime: 5 * 60 * 1000,
  })

  const options: BrandOption[] = (query.data ?? []).map(name => ({ label: name, value: name }))

  return { options, isLoading: query.isLoading }
}
