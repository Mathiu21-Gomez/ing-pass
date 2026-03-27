"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { ImagePlus, X, Download, ZoomIn } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CommentAttachment } from "@/lib/types"

interface ImageUploadProps {
    onImagesChange: (images: CommentAttachment[]) => void
    maxImages?: number
    className?: string
}

function downloadAttachment(att: CommentAttachment) {
    const link = document.createElement("a")
    link.href = `data:${att.type};base64,${att.data}`
    link.download = att.name
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
}

export function ImageUpload({ onImagesChange, maxImages = 5, className }: ImageUploadProps) {
    const [previews, setPreviews] = useState<CommentAttachment[]>([])
    const [previewImg, setPreviewImg] = useState<CommentAttachment | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const files = Array.from(e.target.files ?? [])
        if (files.length === 0) return

        const remaining = maxImages - previews.length
        const toAdd = files.slice(0, remaining)

        let processed = 0
        const newAttachments: CommentAttachment[] = []

        toAdd.forEach((file) => {
            const reader = new FileReader()
            reader.onload = () => {
                const base64 = (reader.result as string).split(",")[1]
                newAttachments.push({
                    id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    data: base64,
                })
                processed++
                if (processed === toAdd.length) {
                    const updated = [...previews, ...newAttachments]
                    setPreviews(updated)
                    onImagesChange(updated)
                }
            }
            reader.readAsDataURL(file)
        })

        if (inputRef.current) inputRef.current.value = ""
    }

    function removeImage(id: string) {
        const updated = previews.filter((p) => p.id !== id)
        setPreviews(updated)
        onImagesChange(updated)
    }

    return (
        <>
            {/* Full-size preview modal */}
            {previewImg && (
                <div
                    className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm"
                    onClick={() => setPreviewImg(null)}
                >
                    <div
                        className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <p className="text-sm text-white/80 truncate max-w-[60%]">{previewImg.name}</p>
                        <div className="flex items-center gap-2">
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-white hover:bg-white/20 hover:text-white"
                                onClick={() => downloadAttachment(previewImg)}
                                title="Descargar"
                            >
                                <Download className="h-4 w-4" />
                            </Button>
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-white hover:bg-white/20 hover:text-white"
                                onClick={() => setPreviewImg(null)}
                                title="Cerrar"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                    <div
                        className="relative flex items-center justify-center w-full h-full px-16 py-16"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <img
                            src={`data:${previewImg.type};base64,${previewImg.data}`}
                            alt={previewImg.name}
                            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                            style={{ maxHeight: "calc(100vh - 8rem)" }}
                        />
                    </div>
                </div>
            )}

            <div className={cn("flex flex-col gap-2", className)}>
                {previews.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {previews.map((img) => (
                            <div
                                key={img.id}
                                className="relative group rounded-xl overflow-hidden border border-border w-24 h-24 shadow-sm"
                            >
                                <img
                                    src={`data:${img.type};base64,${img.data}`}
                                    alt={img.name}
                                    className="w-full h-full object-cover"
                                />
                                {/* Overlay actions */}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                                <button
                                    type="button"
                                    onClick={() => setPreviewImg(img)}
                                    className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                    aria-label="Ver imagen"
                                >
                                    <ZoomIn className="h-5 w-5 text-white drop-shadow" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => removeImage(img.id)}
                                    className="absolute top-1 right-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
                                    aria-label="Eliminar imagen"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 py-1">
                                    <p className="text-[8px] text-white/90 truncate">{img.name}</p>
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
        </>
    )
}
