"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { ImagePlus, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ImageAttachment } from "@/lib/types"

interface ImageUploadProps {
    onImagesChange: (images: ImageAttachment[]) => void
    maxImages?: number
    className?: string
}

export function ImageUpload({ onImagesChange, maxImages = 5, className }: ImageUploadProps) {
    const [previews, setPreviews] = useState<ImageAttachment[]>([])
    const inputRef = useRef<HTMLInputElement>(null)

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const files = Array.from(e.target.files ?? [])
        if (files.length === 0) return

        const remaining = maxImages - previews.length
        const toAdd = files.slice(0, remaining)

        const newAttachments: ImageAttachment[] = toAdd.map((file) => ({
            id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            name: file.name,
            url: URL.createObjectURL(file),
            uploadedBy: "",  // se llena en el componente padre
            uploadedAt: new Date().toISOString(),
        }))

        const updated = [...previews, ...newAttachments]
        setPreviews(updated)
        onImagesChange(updated)

        // Reset input
        if (inputRef.current) inputRef.current.value = ""
    }

    function removeImage(id: string) {
        const img = previews.find((p) => p.id === id)
        if (img) URL.revokeObjectURL(img.url)
        const updated = previews.filter((p) => p.id !== id)
        setPreviews(updated)
        onImagesChange(updated)
    }

    return (
        <div className={cn("flex flex-col gap-2", className)}>
            {previews.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {previews.map((img) => (
                        <div
                            key={img.id}
                            className="relative group rounded-lg overflow-hidden border border-border w-20 h-20"
                        >
                            <img
                                src={img.url}
                                alt={img.name}
                                className="w-full h-full object-cover"
                            />
                            <button
                                type="button"
                                onClick={() => removeImage(img.id)}
                                className="absolute top-0.5 right-0.5 rounded-full bg-black/60 p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                aria-label="Eliminar imagen"
                            >
                                <X className="h-3 w-3" />
                            </button>
                            <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5">
                                <p className="text-[8px] text-white truncate">{img.name}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {previews.length < maxImages && (
                <>
                    <input
                        ref={inputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleFileChange}
                        className="hidden"
                    />
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-xs w-fit"
                        onClick={() => inputRef.current?.click()}
                    >
                        <ImagePlus className="h-3.5 w-3.5" />
                        {previews.length === 0 ? "Adjuntar imagen" : "Agregar más"}
                    </Button>
                </>
            )}
        </div>
    )
}
