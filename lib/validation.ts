// lib/validation.ts
import { z } from 'zod';

export const EVENT_TYPES = [
  'ENTRADA',
  'INICIO_PAUSA_ALMOCO',
  'FIM_PAUSA_ALMOCO',
  'INICIO_PAUSA_JANTA',
  'FIM_PAUSA_JANTA',
  'SAIDA',
  'ENTRADA_EXTRA',
  'SAIDA_EXTRA'
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\(\d{2}\) \d{4,5}-\d{4}$/, 'Telefone deve estar no formato (XX) XXXXX-XXXX');

export const employeeCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: phoneSchema,
  email: z.string().trim().toLowerCase().email(),
  active: z.boolean().optional().default(true)
});

export const employeeUpdateSchema = employeeCreateSchema.partial();

export const pontoSchema = z.object({
  eventType: z.enum(EVENT_TYPES),
  deviceHash: z.string().min(8).max(128),
  exitNote: z.string().min(2).max(500).optional()
});

export const adminLoginSchema = z.object({
  password: z.string().min(1)
});

export const changePasswordSchema = z
  .object({
    current: z.string().min(1),
    next: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .regex(/[A-Z]/, 'Deve conter letra maiúscula')
      .regex(/[a-z]/, 'Deve conter letra minúscula')
      .regex(/\d/, 'Deve conter número')
  })
  .refine((d) => d.current !== d.next, { message: 'Nova senha deve ser diferente da atual' });

export const configSchema = z.object({
  adminEmail: z.string().trim().toLowerCase().email(),
  replyToEmail: z.string().trim().toLowerCase().email('Email profissional inválido'),
  reportSchedule: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato HH:mm (00:00–23:59)'),
  timezone: z.string().min(1)
});

export const requestCodeSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  deviceHash: z.string().min(8).max(128)
});

export const verifyCodeSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  code: z.string().regex(/^\d{6}$/, 'Código de 6 dígitos'),
  deviceHash: z.string().min(8).max(128)
});

export const importBackupSchema = z.object({
  employees: z.array(
    z.object({
      id: z.string().optional(),
      name: z.string(),
      phone: z.string(),
      email: z.string().email(),
      active: z.union([z.boolean(), z.number()]).optional(),
      deviceHash: z.string().nullable().optional()
    })
  ),
  records: z
    .array(
      z.object({
        id: z.string().optional(),
        employeeEmail: z.string().email(),
        eventType: z.enum(EVENT_TYPES),
        timestamp: z.string(),
        ip: z.string(),
        userAgent: z.string(),
        deviceHash: z.string()
      })
    )
    .optional()
    .default([]),
  exitNotes: z
    .array(
      z.object({
        id: z.string().optional(),
        employeeEmail: z.string().email(),
        note: z.string(),
        createdAt: z.string()
      })
    )
    .optional()
    .default([]),
  config: z
    .object({
      adminEmail: z.string().email(),
      replyToEmail: z.string().email().optional().default(''),
      reportSchedule: z.string(),
      timezone: z.string()
    })
    .optional()
});
