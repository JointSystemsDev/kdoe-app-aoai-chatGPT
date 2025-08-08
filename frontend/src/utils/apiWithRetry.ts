import { telemetryService } from './telemetry';

interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  timeout?: number;
}

interface ApiRequestOptions extends RequestInit {
  retryOptions?: RetryOptions;
  context?: {
    conversationId?: string;
    environmentId?: string;
    userId?: string;
    action?: string;
  };
}

class ApiError extends Error {
  public status?: number;
  public statusText?: string;
  public response?: Response;

  constructor(message: string, status?: number, statusText?: string, response?: Response) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.statusText = statusText;
    this.response = response;
  }
}

class TimeoutError extends Error {
  constructor(message: string = 'Request timed out') {
    super(message);
    this.name = 'TimeoutError';
  }
}

class NetworkError extends Error {
  constructor(message: string = 'Network error occurred') {
    super(message);
    this.name = 'NetworkError';
  }
}

export class ApiWithRetry {
  private static defaultRetryOptions: RetryOptions = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2,
    timeout: 30000
  };

  public static async fetch(url: string, options: ApiRequestOptions = {}): Promise<Response> {
    const {
      retryOptions = {},
      context = {},
      ...fetchOptions
    } = options;

    const finalRetryOptions = { ...this.defaultRetryOptions, ...retryOptions };
    let lastError: Error;

    for (let attempt = 0; attempt <= finalRetryOptions.maxRetries!; attempt++) {
      try {
        const response = await this.fetchWithTimeout(url, fetchOptions, finalRetryOptions.timeout!);
        
        // Check if response is ok
        if (!response.ok) {
          const error = new ApiError(
            `HTTP ${response.status}: ${response.statusText}`,
            response.status,
            response.statusText,
            response
          );
          
          // Report error to telemetry
          await telemetryService.reportError(error, {
            ...context,
            action: context.action || `api_request_${url}`
          });

          // Check if we should retry based on status code
          if (this.shouldRetry(response.status, attempt, finalRetryOptions.maxRetries!)) {
            lastError = error;
            await this.delay(this.calculateDelay(attempt, finalRetryOptions));
            continue;
          }
          
          throw error;
        }

        return response;
      } catch (error) {
        lastError = error as Error;
        
        // Report error to telemetry
        await telemetryService.reportError(lastError, {
          ...context,
          action: context.action || `api_request_${url}`
        });

        // Check if we should retry
        const retryInfo = telemetryService.isRetryableError(lastError);
        if (retryInfo.isRetryable && attempt < finalRetryOptions.maxRetries!) {
          await this.delay(retryInfo.retryAfter || this.calculateDelay(attempt, finalRetryOptions));
          continue;
        }

        throw lastError;
      }
    }

    throw lastError!;
  }

  private static async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      return response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new TimeoutError(`Request to ${url} timed out after ${timeout}ms`);
      }
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new NetworkError(`Network error when requesting ${url}`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private static shouldRetry(status: number, attempt: number, maxRetries: number): boolean {
    if (attempt >= maxRetries) return false;
    
    // Retry on server errors (5xx) and some client errors
    return status >= 500 || status === 408 || status === 429;
  }

  private static calculateDelay(attempt: number, options: RetryOptions): number {
    const delay = options.baseDelay! * Math.pow(options.backoffFactor!, attempt);
    return Math.min(delay, options.maxDelay!);
  }

  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Convenience methods for common HTTP methods
  public static async get(url: string, options: ApiRequestOptions = {}): Promise<Response> {
    return this.fetch(url, { ...options, method: 'GET' });
  }

  public static async post(url: string, data?: any, options: ApiRequestOptions = {}): Promise<Response> {
    return this.fetch(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      body: data ? JSON.stringify(data) : undefined
    });
  }

  public static async put(url: string, data?: any, options: ApiRequestOptions = {}): Promise<Response> {
    return this.fetch(url, {
      ...options,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      body: data ? JSON.stringify(data) : undefined
    });
  }

  public static async delete(url: string, options: ApiRequestOptions = {}): Promise<Response> {
    return this.fetch(url, { ...options, method: 'DELETE' });
  }
}

// Export error classes for use in other modules
export { ApiError, TimeoutError, NetworkError };
