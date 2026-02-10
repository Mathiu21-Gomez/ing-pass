import { z } from "zod"

// Validador de RUT chileno con dígito verificador
function validateRut(rut: string): boolean {
    // Limpiar el RUT
    const cleanRut = rut.replace(/\./g, "").replace(/-/g, "").toUpperCase()
    if (cleanRut.length < 2) return false

    const body = cleanRut.slice(0, -1)
    const dv = cleanRut.slice(-1)

    // Calcular dígito verificador
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
    email: z.string().email("Email inválido"),
    role: z.enum(["admin", "trabajador"], {
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
})

export type TaskFormData = z.infer<typeof taskSchema>

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
