import { ProjectCalendar } from "@/components/project-calendar"

export default function TrabajadorCalendarioPage() {
  return (
    <ProjectCalendar
      basePath="/trabajador"
      title="Calendario"
      description="Mapa mensual de proyectos a los que estás asignado. Seleccioná un día para ver fechas de inicio y entrega."
    />
  )
}
