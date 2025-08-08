interface ErrorTelemetryData {
  error: {
    message: string;
    stack?: string;
    name: string;
  };
  context: {
    url: string;
    userAgent: string;
    timestamp: string;
    conversationId?: string;
    environmentId?: string;
    userId?: string;
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'network' | 'timeout' | 'api' | 'streaming' | 'auth' | 'unknown';
}

interface RetryableError {
  isRetryable: boolean;
  retryAfter?: number;
  maxRetries?: number;
}

export class TelemetryService {
  private static instance: TelemetryService;
  private appInsightsKey?: string;

  private constructor() {
    // Initialize with app insights key from frontend settings
    this.initializeAppInsights();
  }

  public static getInstance(): TelemetryService {
    if (!TelemetryService.instance) {
      TelemetryService.instance = new TelemetryService();
    }
    return TelemetryService.instance;
  }

  private async initializeAppInsights() {
    try {
      const response = await fetch('/frontend_settings');
      const settings = await response.json();
      this.appInsightsKey = settings.ui?.appinsights_instrumentationkey;
    } catch (error) {
      console.warn('Failed to initialize Application Insights:', error);
    }
  }

  public async reportError(
    error: Error,
    context: {
      conversationId?: string;
      environmentId?: string;
      userId?: string;
      action?: string;
    } = {}
  ): Promise<void> {
    const telemetryData: ErrorTelemetryData = {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      context: {
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        conversationId: context.conversationId,
        environmentId: context.environmentId,
        userId: context.userId
      },
      severity: this.categorizeErrorSeverity(error),
      category: this.categorizeError(error)
    };

    // Send to backend for Application Insights
    try {
      await fetch('/api/telemetry/error', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...telemetryData,
          action: context.action
        })
      });
    } catch (telemetryError) {
      console.error('Failed to send error telemetry:', telemetryError);
    }

    // Also log to console for development
    console.error('Error reported to telemetry:', error, context);
  }

  public categorizeError(error: Error): ErrorTelemetryData['category'] {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch')) {
      return 'network';
    }
    if (message.includes('timeout') || message.includes('aborted')) {
      return 'timeout';
    }
    if (message.includes('unauthorized') || message.includes('forbidden')) {
      return 'auth';
    }
    if (message.includes('stream') || message.includes('reader')) {
      return 'streaming';
    }
    if (message.includes('api') || message.includes('server')) {
      return 'api';
    }
    
    return 'unknown';
  }

  public categorizeErrorSeverity(error: Error): ErrorTelemetryData['severity'] {
    const category = this.categorizeError(error);
    
    switch (category) {
      case 'auth':
        return 'critical';
      case 'api':
        return 'high';
      case 'timeout':
      case 'streaming':
        return 'medium';
      case 'network':
        return 'low';
      default:
        return 'medium';
    }
  }

  public isRetryableError(error: Error): RetryableError {
    const category = this.categorizeError(error);
    const message = error.message.toLowerCase();
    
    switch (category) {
      case 'network':
      case 'timeout':
        return { isRetryable: true, retryAfter: 1000, maxRetries: 3 };
      case 'api':
        if (message.includes('500') || message.includes('502') || message.includes('503')) {
          return { isRetryable: true, retryAfter: 2000, maxRetries: 2 };
        }
        return { isRetryable: false };
      case 'streaming':
        return { isRetryable: true, retryAfter: 500, maxRetries: 2 };
      case 'auth':
        return { isRetryable: false };
      default:
        return { isRetryable: false };
    }
  }

  public getUserFriendlyErrorMessage(error: Error): string {
    const category = this.categorizeError(error);
    
    switch (category) {
      case 'network':
        return 'Network connection issue. Please check your internet connection and try again.';
      case 'timeout':
        return 'Request timed out. Please try again or rephrase your question.';
      case 'auth':
        return 'Authentication issue. Please refresh the page and try again.';
      case 'streaming':
        return 'Connection interrupted. Please try again.';
      case 'api':
        return 'I\'m experiencing technical difficulties. Please refresh the page or try again later.';
      default:
        return 'Sorry, something went wrong. Would you like to try rephrasing your question?';
    }
  }
}

export const telemetryService = TelemetryService.getInstance();
