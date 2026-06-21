import { Request } from 'express';
import { isDebugApiEnabled } from './is-debug-api-enabled';

export type ApiDebugMeta = {
  timestamp: string;
  method: string;
  path: string;
  exception: string;
  message: string;
  stack?: string[];
} & Record<string, unknown>;

export function appendApiDebugMeta<T extends Record<string, unknown>>(
  body: T,
  request: Request,
  exception: Error,
  extra?: Record<string, unknown>,
): T & { debug?: ApiDebugMeta } {
  if (!isDebugApiEnabled()) {
    return body;
  }

  return {
    ...body,
    debug: {
      timestamp: new Date().toISOString(),
      method: request.method,
      path: request.url,
      exception: exception.name,
      message: exception.message,
      stack: exception.stack?.split('\n'),
      ...extra,
    },
  };
}
