import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { queryKeys } from '../api/queryKeys'
import { findCbsOptionIdByName } from '../data/izmir-locations'

const CBS_STALE_MS = 60 * 60 * 1000

function withCurrentValue(
  options: Array<{ value: string; label: string }>,
  current: string,
): Array<{ value: string; label: string }> {
  const trimmed = current.trim()
  if (!trimmed) return options
  if (options.some(item => item.value === trimmed)) return options
  return [{ value: trimmed, label: trimmed }, ...options]
}

/** Mahalle adına göre İzmir CBS cadde ve kapı no listeleri (#2655). */
export function useIzmirCbsStreetNoCatalog(
  districtId: string,
  neighborhoodName: string,
  streetName: string,
  streetNo: string,
) {
  const hasNeighborhood = neighborhoodName.trim().length > 0

  const neighborhoodsQuery = useQuery({
    queryKey: queryKeys.izmirCbs.neighborhoods(districtId),
    queryFn: () => api.getIzmirCbsNeighborhoods(districtId),
    enabled: districtId.trim().length > 0 && hasNeighborhood,
    staleTime: CBS_STALE_MS,
  })
  const neighborhoodId = useMemo(
    () => findCbsOptionIdByName(neighborhoodsQuery.data, neighborhoodName),
    [neighborhoodsQuery.data, neighborhoodName],
  )

  const streetsQuery = useQuery({
    queryKey: queryKeys.izmirCbs.streets(neighborhoodId),
    queryFn: () => api.getIzmirCbsStreets(neighborhoodId),
    enabled: neighborhoodId.length > 0,
    staleTime: CBS_STALE_MS,
  })
  const streetId = useMemo(
    () => findCbsOptionIdByName(streetsQuery.data, streetName),
    [streetsQuery.data, streetName],
  )

  const doorNumbersQuery = useQuery({
    queryKey: queryKeys.izmirCbs.doorNumbers(streetId, neighborhoodId),
    queryFn: () => api.getIzmirCbsDoorNumbers(streetId, neighborhoodId),
    enabled: streetId.length > 0 && neighborhoodId.length > 0,
    staleTime: CBS_STALE_MS,
  })

  const streetOptions = useMemo(
    () => withCurrentValue(
      (streetsQuery.data ?? []).map(item => ({ value: item.name, label: item.name })),
      streetName,
    ),
    [streetsQuery.data, streetName],
  )
  const doorNoOptions = useMemo(
    () => withCurrentValue(
      (doorNumbersQuery.data ?? []).map(item => ({ value: item.name, label: item.name })),
      streetNo,
    ),
    [doorNumbersQuery.data, streetNo],
  )

  return {
    streetOptions,
    doorNoOptions,
    streetsLoading: streetsQuery.isFetching,
    doorsLoading: doorNumbersQuery.isFetching,
  }
}
