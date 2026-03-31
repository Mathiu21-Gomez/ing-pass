"use client"

import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { CommentAttachment } from "@/lib/types"
import { Download, ImagePlus, Loader2, X, ZoomIn } from "lucide-react"

export interface ImageUploadItem {
  id: string
  name: string
  type: string
  size: number
  data?: string
  url?: string
  isUploading?: boolean
}

interface ImageUploadProps {
  className?: string
  maxImages?: number
  onFilesSelected?: (files: File[]) => Promise<void> | void
  onImagesChange?: (images: CommentAttachment[]) => void
  onRemoveImage?: (id: string) => Promise<void> | void
  value?: ImageUploadItem[]
}

function downloadAttachment(att: ImageUploadItem) {
  const link = document.createElement("a")

  if (att.data) {
    link.href = `data:${att.type};base64,${att.data}`
  } else if (att.url) {
    link.href = att.url
  } else {
    return
  }

  link.download = att.name
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function ImageUpload({
  className,
  maxImages = 5,
  onFilesSelected,
  onImagesChange,
  onRemoveImage,
  value,
}: ImageUploadProps) {
  const isControlled = Array.isArray(value)
  const [previews, setPreviews] = useState<CommentAttachment[]>([])
  const [previewImg, setPreviewImg] = useState<ImageUploadItem | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const items: ImageUploadItem[] = isControlled
    ? value ?? []
    : previews.map((item) => ({
        data: item.data,
        id: item.id,
        name: item.name,
        size: item.size,
        type: item.type,
      }))

  useEffect(() => {
    if (!previewImg) return

    const stillExists = items.some((item) => item.id === previewImg.id)
    if (!stillExists) {
      setPreviewImg(null)
    }
  }, [items, previewImg])

  function emitLegacyChange(updated: CommentAttachment[]) {
    setPreviews(updated)
    onImagesChange?.(updated)
  }

  function handleLegacyFiles(files: File[]) {
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
        processed += 1

        if (processed === toAdd.length) {
          emitLegacyChange([...previews, ...newAttachments])
        }
      }

      reader.readAsDataURL(file)
    })
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    const remaining = Math.max(0, maxImages - items.length)
    const toAdd = files.slice(0, remaining)

    try {
      if (isControlled) {
        await onFilesSelected?.(toAdd)
      } else {
        handleLegacyFiles(toAdd)
      }
    } finally {
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  async function removeImage(id: string) {
    if (isControlled) {
      await onRemoveImage?.(id)
      return
    }

    emitLegacyChange(previews.filter((preview) => preview.id !== id))
  }

  return (
    <>
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
              src={previewImg.data ? `data:${previewImg.type};base64,${previewImg.data}` : previewImg.url}
              alt={previewImg.name}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              style={{ maxHeight: "calc(100vh - 8rem)" }}
            />
          </div>
        </div>
      )}

      <div className={cn("flex flex-col gap-2", className)}>
        {items.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {items.map((img) => (
              <div
                key={img.id}
                className="relative group rounded-xl overflow-hidden border border-border w-24 h-24 shadow-sm"
              >
                <img
                  src={img.data ? `data:${img.type};base64,${img.data}` : img.url}
                  alt={img.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                {!img.isUploading && (
                  <button
                    type="button"
                    onClick={() => setPreviewImg(img)}
                    className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Ver imagen"
                  >
                    <ZoomIn className="h-5 w-5 text-white drop-shadow" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void removeImage(img.id)}
                  className="absolute top-1 right-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
                  aria-label="Eliminar imagen"
                >
                  <X className="h-3 w-3" />
                </button>
                {img.isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 py-1">
                  <p className="text-[8px] text-white/90 truncate">{img.name}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {items.length < maxImages && (
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
              {items.length === 0 ? "Adjuntar imagen" : "Agregar más"}
            </Button>
          </>
        )}
      </div>
    </>
  )
}
