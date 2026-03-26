"use client"

import { WorkdayPanel } from "@/components/workday-panel"

export default function MiJornadaPage() {
  return (
    <div className="flex flex-col gap-6 page-enter">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Mi Jornada</h1>
        <p className="text-sm text-muted-foreground">
          Gestioná tu tiempo de trabajo diario
        </p>
      </div>
      <WorkdayPanel showPreStart />
    </div>
  )
}
