type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';

class Logger {
  private level: LogLevel;
  private levels: { [key in LogLevel]: number } = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    none: 4,
  };

  constructor() {
    // Get log level from environment variable, default to 'info'
    const envLevel = (process.env.NEXT_PUBLIC_LOG_LEVEL || 'info').toLowerCase() as LogLevel;
    this.level = this.isValidLogLevel(envLevel) ? envLevel : 'info';
  }

  private isValidLogLevel(level: string): level is LogLevel {
    return ['debug', 'info', 'warn', 'error', 'none'].includes(level);
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] >= this.levels[this.level];
  }

  debug(...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.log('[DEBUG]', ...args);
    }
  }

  info(...args: any[]): void {
    if (this.shouldLog('info')) {
      console.log('[INFO]', ...args);
    }
  }

  warn(...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn('[WARN]', ...args);
    }
  }

  error(...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error('[ERROR]', ...args);
    }
  }
}

export const logger = new Logger();
