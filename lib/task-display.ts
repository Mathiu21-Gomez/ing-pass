/**
 * Formats a task's correlative ID in project-prefixed form.
 * Example: project "Talca" + correlativeId 1 → "TAL-0001"
 */
export function formatCorrelativeId(projectName: string, correlativeId: number): string {
  const prefix = projectName
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 3)
    .padEnd(3, "X")

  const paddedId = String(correlativeId).padStart(4, "0")
  return `${prefix}-${paddedId}`
}

/**
 * Returns true when a task's due date is in the past and it's not yet finished.
 */
export function isTaskOverdue(task: { dueDate: string | null; status: string }): boolean {
  if (!task.dueDate || task.status === "finalizado") return false
  return new Date(task.dueDate) < new Date(new Date().toDateString())
}
