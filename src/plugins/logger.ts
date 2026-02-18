import type { AppEnv } from "../config/env";

const levels = ["debug", "info", "warn", "error"] as const;
type LogLevel = (typeof levels)[number];

export type LogContext = Record<string, unknown>;

export type Logger = {
  debug: (message: string, context?: LogContext) => void;
  info: (message: string, context?: LogContext) => void;
  warn: (message: string, context?: LogContext) => void;
  error: (message: string, context?: LogContext) => void;
};

function levelWeight(level: LogLevel): number {
  return levels.indexOf(level);
}

function emit(level: LogLevel, minLevel: LogLevel, message: string, context: LogContext = {}): void {
  if (levelWeight(level) < levelWeight(minLevel)) {
    return;
  }

  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
    ...context
  };

  console.log(JSON.stringify(payload));
}

export function createLogger(env: AppEnv): Logger {
  const minLevel = env.LOG_LEVEL;

  return {
    debug(message, context) {
      emit("debug", minLevel, message, context);
    },
    info(message, context) {
      emit("info", minLevel, message, context);
    },
    warn(message, context) {
      emit("warn", minLevel, message, context);
    },
    error(message, context) {
      emit("error", minLevel, message, context);
    }
  };
}
