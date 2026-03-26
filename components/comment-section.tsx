"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ImageUpload } from "@/components/image-upload"
import { usersApi } from "@/lib/services/api"
import { useApiData } from "@/hooks/use-api-data"
import { MessageSquare, Send, Hash } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Comment, CommentAttachment, User } from "@/lib/types"

interface CommentSectionProps {
    comments: Comment[]
    onAddComment: (text: string, attachments: CommentAttachment[], referenceId?: string) => void
    currentUserId: string
    className?: string
}

export function CommentSection({ comments, onAddComment, currentUserId, className }: CommentSectionProps) {
    const [text, setText] = useState("")
    const [referenceId, setReferenceId] = useState("")
    const [images, setImages] = useState<CommentAttachment[]>([])
    const [showRefField, setShowRefField] = useState(false)
    const fetchUsers = useCallback(() => usersApi.getAll(), [])
    const { data: allUsers } = useApiData(fetchUsers, [] as User[])

    function handleSubmit() {
        if (!text.trim()) return
        onAddComment(text.trim(), images, referenceId.trim() || undefined)
        setText("")
        setReferenceId("")
        setImages([])
        setShowRefField(false)
    }

    function formatDate(dateStr: string) {
        const d = new Date(dateStr)
        return d.toLocaleDateString("es-CL", { day: "numeric", month: "short" }) +
            " " + d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })
    }

    return (
        <div className={cn("flex flex-col gap-3", className)}>
            <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs font-medium text-foreground">
                    Comentarios {comments.length > 0 && `(${comments.length})`}
                </p>
            </div>

            {/* Comments list */}
            {comments.length > 0 && (
                <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                    {comments.map((comment) => {
                        const author = allUsers.find((u) => u.id === comment.authorId)
                        const roleColors: Record<string, string> = {
                            admin: "from-violet-500 to-violet-600",
                            coordinador: "from-blue-500 to-blue-600",
                            trabajador: "from-emerald-500 to-emerald-600",
                            externo: "from-teal-500 to-teal-600",
                        }
                        const gradient = roleColors[author?.role ?? ""] ?? "from-gray-500 to-gray-600"

                        return (
                            <div key={comment.id} className="flex gap-2.5 rounded-lg bg-muted/30 px-3 py-2.5 border border-border/50">
                                <div className={cn("flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br text-[10px] font-bold text-white shrink-0 mt-0.5", gradient)}>
                                    {author?.name?.charAt(0) ?? "?"}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="text-xs font-semibold text-foreground">
                                            {author?.name?.split(" ").slice(0, 2).join(" ") ?? "Desconocido"}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">
                                            {formatDate(comment.createdAt)}
                                        </span>
                                    </div>

                                    {comment.referenceId && (
                                        <div className="flex items-center gap-1 mb-1">
                                            <Hash className="h-3 w-3 text-primary" />
                                            <span className="text-[10px] font-mono font-medium text-primary bg-primary/10 rounded px-1.5 py-0.5">
                                                {comment.referenceId}
                                            </span>
                                        </div>
                                    )}

                                    <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words">{comment.text}</p>

                                    {comment.attachments && comment.attachments.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {comment.attachments.map((img) => (
                                                <a
                                                    key={img.id}
                                                    href={`data:${img.type};base64,${img.data}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="rounded-md overflow-hidden border border-border w-24 h-24 block hover:opacity-80 transition-opacity"
                                                >
                                                    <img
                                                        src={`data:${img.type};base64,${img.data}`}
                                                        alt={img.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Add comment form */}
            <div className="rounded-lg border border-border bg-muted/20 p-3 flex flex-col gap-2.5">
                <Textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Escribe un comentario..."
                    rows={2}
                    className="min-h-[60px] resize-none text-sm bg-background"
                />

                {showRefField && (
                    <div className="flex flex-col gap-1">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                            <Hash className="h-3 w-3" />
                            ID de referencia (documento/trabajo externo)
                        </Label>
                        <Input
                            value={referenceId}
                            onChange={(e) => setReferenceId(e.target.value)}
                            placeholder="Ej: DOC-2024-0145, PLN-A-003..."
                            className="h-8 text-xs font-mono"
                        />
                    </div>
                )}

                <ImageUpload onImagesChange={setImages} maxImages={3} />

                <div className="flex items-center justify-between">
                    <button
                        type="button"
                        onClick={() => setShowRefField(!showRefField)}
                        className={cn(
                            "flex items-center gap-1 text-[10px] px-2 py-1 rounded-md transition-colors",
                            showRefField
                                ? "bg-primary/10 text-primary"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        )}
                    >
                        <Hash className="h-3 w-3" />
                        {showRefField ? "Ocultar referencia" : "Agregar ID referencia"}
                    </button>
                    <Button
                        size="sm"
                        className="h-7 gap-1.5 text-xs"
                        disabled={!text.trim()}
                        onClick={handleSubmit}
                    >
                        <Send className="h-3 w-3" />
                        Enviar
                    </Button>
                </div>
            </div>
        </div>
    )
}
