// Cloud Functions / Firebase Admin / Genkit の型定義（ローカル単体ビルド・型検証環境用）
declare module 'firebase-admin/app' {
  export interface App {
    name: string;
  }
  export function initializeApp(options?: Record<string, unknown>): App;
  export function getApps(): App[];
}

declare module 'firebase-admin/firestore' {
  export interface QueryDocumentSnapshot {
    id: string;
    ref: DocumentReference;
    exists: boolean;
    data(): Record<string, unknown>;
  }
  export interface QuerySnapshot {
    empty: boolean;
    docs: QueryDocumentSnapshot[];
  }
  export interface DocumentSnapshot {
    id: string;
    exists: boolean;
    data(): Record<string, unknown> | undefined;
  }
  export interface Query {
    where(field: string, op: string, value: unknown): Query;
    limit(n: number): Query;
    get(): Promise<QuerySnapshot>;
  }
  export interface CollectionReference extends Query {
    doc(id?: string): DocumentReference;
    add(data: Record<string, unknown>): Promise<DocumentReference>;
  }
  export interface DocumentReference {
    id: string;
    collection(name: string): CollectionReference;
    get(): Promise<DocumentSnapshot>;
    set(data: Record<string, unknown>, options?: { merge?: boolean }): Promise<void>;
    update(data: Record<string, unknown>): Promise<void>;
    delete(): Promise<void>;
  }
  export interface Firestore {
    collection(name: string): CollectionReference;
  }
  export function getFirestore(): Firestore;
}

declare module 'firebase-functions/params' {
  export interface SecretParam {
    name: string;
    value(): string;
  }
  export function defineSecret(name: string): SecretParam;
}

declare module 'firebase-functions/v2/https' {
  import type { SecretParam } from 'firebase-functions/params';
  export class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string);
  }
  export interface CallableRequest<T = unknown> {
    data: T;
    auth?: { uid: string };
  }
  export interface CallableOptions {
    region?: string;
    secrets?: SecretParam[];
    cors?: boolean;
  }
  export function onCall<TIn = unknown, TOut = unknown>(
    opts: CallableOptions,
    handler: (request: CallableRequest<TIn>) => Promise<TOut> | TOut
  ): (request: CallableRequest<TIn>) => Promise<TOut>;
}

declare module 'firebase-functions/v2/scheduler' {
  import type { SecretParam } from 'firebase-functions/params';
  export interface ScheduleOptions {
    schedule: string;
    timeZone?: string;
    region?: string;
    secrets?: SecretParam[];
  }
  export function onSchedule(
    opts: ScheduleOptions,
    handler: (event: unknown) => Promise<void> | void
  ): (event: unknown) => Promise<void>;
}

declare module 'genkit' {
  import type { z } from 'zod';
  export interface FlowConfig<I extends z.ZodTypeAny, O extends z.ZodTypeAny> {
    name: string;
    inputSchema: I;
    outputSchema: O;
  }
  export interface GenkitInstance {
    defineFlow<I extends z.ZodTypeAny, O extends z.ZodTypeAny>(
      config: FlowConfig<I, O>,
      fn: (input: z.infer<I>) => Promise<z.infer<O>>
    ): (input: z.infer<I>) => Promise<z.infer<O>>;
  }
  export function genkit(options: { plugins?: unknown[] }): GenkitInstance;
}

declare module '@genkit-ai/googleai' {
  export function googleAI(options?: Record<string, unknown>): unknown;
}
