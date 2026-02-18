import { z } from "zod"

// Validador de RUT chileno con dígito verificador
function validateRut(rut: string): boolean {
    const cleanRut = rut.replace(/\./g, "").replace(/-/g, "").toUpperCase()
    if (cleanRut.length < 2) return false

    const body = cleanRut.slice(0, -1)
    const dv = cleanRut.slice(-1)

    let sum = 0
    let multiplier = 2

    for (let i = body.length - 1; i >= 0; i--) {
        sum += parseInt(body[i]) * multiplier
        multiplier = multiplier === 7 ? 2 : multiplier + 1
    }

    const expectedDv = 11 - (sum % 11)
    const expectedDvChar =
        expectedDv === 11 ? "0" : expectedDv === 10 ? "K" : expectedDv.toString()

    return dv === expectedDvChar
}

// Schema para Cliente
export const clientSchema = z.object({
    name: z
        .string()
        .min(3, "El nombre debe tener al menos 3 caracteres")
        .max(100, "El nombre no puede exceder 100 caracteres"),
    rut: z
        .string()
        .regex(
            /^\d{1,2}\.\d{3}\.\d{3}-[\dkK]$/,
            "Formato de RUT inválido (ej: 12.345.678-9)"
        )
        .refine(validateRut, "El dígito verificador del RUT es inválido"),
    contact: z
        .string()
        .min(2, "El nombre de contacto debe tener al menos 2 caracteres")
        .max(100, "El nombre de contacto no puede exceder 100 caracteres"),
    email: z.string().email("Email inválido"),
    address: z.string().optional().or(z.literal("")),
})

export type ClientFormData = z.infer<typeof clientSchema>

// Schema para Usuario
export const userSchema = z.object({
    name: z
        .string()
        .min(3, "El nombre debe tener al menos 3 caracteres")
        .max(100, "El nombre no puede exceder 100 caracteres"),
    email: z.string().email("Email corporativo inválido"),
    emailPersonal: z.string().email("Email personal inválido").or(z.literal("")),
    role: z.enum(["admin", "coordinador", "trabajador", "externo"], {
        required_error: "Selecciona un rol",
    }),
    position: z
        .string()
        .min(2, "El cargo debe tener al menos 2 caracteres")
        .max(50, "El cargo no puede exceder 50 caracteres"),
    active: z.boolean().default(true),
    scheduleType: z.enum(["fijo", "libre"]).default("fijo"),
    scheduleStart: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM requerido"),
    scheduleEnd: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM requerido"),
})

export type UserFormData = z.infer<typeof userSchema>

// Schema para Proyecto
export const projectSchema = z
    .object({
        name: z
            .string()
            .min(3, "El nombre debe tener al menos 3 caracteres")
            .max(100, "El nombre no puede exceder 100 caracteres"),
        description: z
            .string()
            .min(10, "La descripción debe tener al menos 10 caracteres")
            .max(500, "La descripción no puede exceder 500 caracteres"),
        clientId: z.string().min(1, "Selecciona un cliente"),
        coordinatorId: z.string().min(1, "Selecciona un coordinador"),
        stage: z.string().min(1, "La etapa es requerida"),
        startDate: z.string().min(1, "La fecha de inicio es requerida"),
        endDate: z.string().min(1, "La fecha de fin es requerida"),
        status: z.enum(["Activo", "Pausado", "Finalizado"], {
            required_error: "Selecciona un estado",
        }),
        assignedWorkers: z
            .array(z.string())
            .min(1, "Asigna al menos un trabajador"),
    })
    .refine(
        (data) => {
            if (!data.startDate || !data.endDate) return true
            return new Date(data.endDate) >= new Date(data.startDate)
        },
        {
            message: "La fecha de fin debe ser posterior a la fecha de inicio",
            path: ["endDate"],
        }
    )

export type ProjectFormData = z.infer<typeof projectSchema>

// Schema para Tarea
export const taskSchema = z.object({
    name: z
        .string()
        .min(3, "El nombre debe tener al menos 3 caracteres")
        .max(100, "El nombre no puede exceder 100 caracteres"),
    description: z
        .string()
        .min(5, "La descripción debe tener al menos 5 caracteres")
        .max(300, "La descripción no puede exceder 300 caracteres"),
    dueDate: z.string().optional().or(z.literal("")),
})

export type TaskFormData = z.infer<typeof taskSchema>

// Schema para Actividad
export const activitySchema = z.object({
    name: z
        .string()
        .min(3, "El nombre debe tener al menos 3 caracteres")
        .max(100, "El nombre no puede exceder 100 caracteres"),
    description: z
        .string()
        .min(5, "La descripción debe tener al menos 5 caracteres")
        .max(300, "La descripción no puede exceder 300 caracteres"),
    dueDate: z.string().optional().or(z.literal("")),
})

export type ActivityFormData = z.infer<typeof activitySchema>

// Schema para Comentario
export const commentSchema = z.object({
    text: z
        .string()
        .min(1, "El comentario no puede estar vacío")
        .max(500, "El comentario no puede exceder 500 caracteres"),
})

export type CommentFormData = z.infer<typeof commentSchema>

// Helper para formatear errores de Zod
export function formatZodErrors(
    errors: z.ZodError
): Record<string, string> {
    return errors.issues.reduce(
        (acc, issue) => {
            const path = issue.path.join(".")
            acc[path] = issue.message
            return acc
        },
        {} as Record<string, string>
    )
}
