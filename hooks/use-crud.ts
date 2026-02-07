"use client"

import { useState, useCallback, useMemo } from "react"

export interface UseCrudOptions<T> {
    searchFields?: (keyof T)[]
}

export function useCrud<T extends { id: string }>(
    initialData: T[],
    options: UseCrudOptions<T> = {}
) {
    const [items, setItems] = useState<T[]>(initialData)
    const [search, setSearch] = useState("")
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editing, setEditing] = useState<T | null>(null)
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

    const add = useCallback((item: T) => {
        setItems((prev) => [...prev, item])
    }, [])

    const update = useCallback((id: string, data: Partial<T>) => {
        setItems((prev) =>
            prev.map((item) => (item.id === id ? { ...item, ...data } : item))
        )
    }, [])

    const remove = useCallback((id: string) => {
        setItems((prev) => prev.filter((item) => item.id !== id))
        setDeleteConfirmId(null)
    }, [])

    const openCreate = useCallback(() => {
        setEditing(null)
        setDialogOpen(true)
    }, [])

    const openEdit = useCallback((item: T) => {
        setEditing(item)
        setDialogOpen(true)
    }, [])

    const closeDialog = useCallback(() => {
        setDialogOpen(false)
        setEditing(null)
    }, [])

    const confirmDelete = useCallback((id: string) => {
        setDeleteConfirmId(id)
    }, [])

    const cancelDelete = useCallback(() => {
        setDeleteConfirmId(null)
    }, [])

    const filteredItems = useMemo(() => {
        if (!search.trim()) return items

        const searchLower = search.toLowerCase()
        const fields = options.searchFields

        return items.filter((item) => {
            if (fields && fields.length > 0) {
                return fields.some((field) => {
                    const value = item[field]
                    if (typeof value === "string") {
                        return value.toLowerCase().includes(searchLower)
                    }
                    return false
                })
            }
            // Default: search all string fields
            return Object.values(item).some(
                (value) =>
                    typeof value === "string" && value.toLowerCase().includes(searchLower)
            )
        })
    }, [items, search, options.searchFields])

    return {
        items,
        filteredItems,
        search,
        setSearch,
        dialogOpen,
        setDialogOpen,
        editing,
        setEditing,
        deleteConfirmId,
        add,
        update,
        remove,
        openCreate,
        openEdit,
        closeDialog,
        confirmDelete,
        cancelDelete,
    }
}
