"use client"

import { useState, useEffect, useCallback } from "react"

/**
 * Generic hook for fetching data from API endpoints.
 * Returns { data, loading, error, refetch }.
 */
export function useApiData<T>(
    fetcher: () => Promise<T>,
    defaultValue: T
) {
    const [data, setData] = useState<T>(defaultValue)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const refetch = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const result = await fetcher()
            setData(result)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error desconocido")
        } finally {
            setLoading(false)
        }
    }, [fetcher])

    useEffect(() => {
        refetch()
    }, [refetch])

    return { data, loading, error, refetch, setData }
}
