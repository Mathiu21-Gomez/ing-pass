"use client"

import Link from "next/link"
import { useTimer } from "@/lib/contexts/timer-context"
import { ChatPanel } from "@/components/chat-panel"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { MessageSquare, Clock, ArrowRight, Newspaper } from "lucide-react"

export default function TrabajadorComunicacionPage() {
  const { status, activeSessionId } = useTimer()

  const isActive = status === "trabajando" || status === "pausado" || status === "colacion" || status === "reunion"

  if (!isActive || !activeSessionId) {
    return (
      <div className="flex flex-col gap-6 page-enter">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Comunicación</h1>
          <p className="text-sm text-muted-foreground">Mensajes durante tu jornada laboral</p>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Clock className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-base font-medium text-foreground">Jornada no iniciada</p>
            <p className="text-sm text-muted-foreground text-center max-w-xs">
              El chat se habilita cuando iniciás tu jornada laboral en la página <strong>Mi Jornada</strong>.
              Los mensajes quedan vinculados a cada jornada.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Link href="/trabajador/mi-jornada">
                <Button className="gap-2">
                  Ir a Mi Jornada
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/trabajador/noticias">
                <Button variant="outline" className="gap-2">
                  Ver Novedades
                  <Newspaper className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 page-enter">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Comunicación</h1>
        <p className="text-sm text-muted-foreground">
          Mensajes con el equipo · Jornada activa
        </p>
      </div>

      <ChatPanel
        sessionId={activeSessionId}
        title="Chat de jornada"
        placeholder="Escribí un mensaje al equipo..."
        className="min-h-[500px]"
      />

      <p className="text-xs text-muted-foreground text-center">
        <MessageSquare className="inline h-3 w-3 mr-1" />
        Los mensajes son visibles para admin y coordinadores. Actualizando cada 15 segundos.
      </p>
    </div>
  )
}
