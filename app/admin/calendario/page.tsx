import { ProjectCalendar } from "@/components/project-calendar"

export default function AdminCalendarioPage() {
  return (
    <ProjectCalendar
      basePath="/admin"
      title="Calendario"
      description="Mapa mensual de proyectos activos con fechas de inicio y entrega. Hacé hover en un día para una vista rápida, seleccionalo para anclar el detalle."
    />
  )
}
