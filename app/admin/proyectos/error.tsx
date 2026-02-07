"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error(error)
    }, [error])

    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <div className="text-center">
                <h2 className="text-lg font-semibold text-foreground">Algo salió mal</h2>
                <p className="text-sm text-muted-foreground mt-1">
                    Ha ocurrido un error al cargar esta página
                </p>
            </div>
            <Button onClick={reset} variant="outline">
                Reintentar
            </Button>
        </div>
    )
}
