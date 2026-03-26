"use client"

import { PersonalHistorial } from "@/components/personal-historial"

export default function TrabajadorHistorialPage() {
  return (
    <div className="flex flex-col gap-6 page-enter">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Historial de Jornadas</h1>
        <p className="text-sm text-muted-foreground">Tus registros de trabajo</p>
      </div>
      <PersonalHistorial />
    </div>
  )
}
