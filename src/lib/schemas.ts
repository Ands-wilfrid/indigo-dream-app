import { z } from "zod";

export const signInSchema = z.object({
  email: z.string().trim().email("Email invalide").max(255),
  password: z.string().min(1, "Requis").max(72),
});

export const signUpSchema = z.object({
  fullName: z.string().trim().min(1, "Requis").max(100),
  email: z.string().trim().email("Email invalide").max(255),
  password: z.string().min(1, "Requis").max(72),
});

export const projectSchema = z.object({
  name: z.string().trim().min(1, "Requis").max(120),
  description: z.string().trim().max(2000).optional(),
  manager_id: z.string().uuid().nullable().optional(),
  due_date: z.string().optional().nullable(),
  status: z.enum(["active", "on_hold", "completed", "archived"]),
});

export const taskSchema = z.object({
  title: z.string().trim().min(1, "Requis").max(200),
  description: z.string().trim().max(2000).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  assignee_id: z.string().uuid().nullable().optional(),
  due_date: z.string().optional().nullable(),
  status: z.enum(["todo", "in_progress", "done"]),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type ProjectInput = z.infer<typeof projectSchema>;
export type TaskInput = z.infer<typeof taskSchema>;
