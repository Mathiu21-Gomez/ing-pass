import { ProjectCalendar } from "@/components/project-calendar"

export default function CoordinadorCalendarioPage() {
  return (
    <ProjectCalendar
      basePath="/coordinador"
      title="Calendario"
      description="Mapa mensual de proyectos a tu cargo con fechas de inicio y entrega. Hacé hover en un día para una vista rápida, seleccionalo para anclar el detalle."
    />
  )
}
