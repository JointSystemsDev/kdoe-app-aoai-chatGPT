import React from 'react';
import { Stack, DefaultButton, PrimaryButton, MessageBar, MessageBarType } from '@fluentui/react';
import { ErrorCircleRegular } from '@fluentui/react-icons';
import { t } from '../../utils/localization';
import { telemetryService } from '../../utils/telemetry';
import styles from './ErrorDisplay.module.css';

interface ErrorDisplayProps {
  error: Error;
  onRetry?: () => void;
  onRefresh?: () => void;
  onRephrase?: () => void;
  onReportIssue?: () => void;
  showRetry?: boolean;
  showRefresh?: boolean;
  showRephrase?: boolean;
  showReportIssue?: boolean;
  context?: {
    conversationId?: string;
    environmentId?: string;
    userId?: string;
  };
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  onRetry,
  onRefresh,
  onRephrase,
  onReportIssue,
  showRetry = true,
  showRefresh = true,
  showRephrase = true,
  showReportIssue = true,
  context
}) => {
  const userFriendlyMessage = telemetryService.getUserFriendlyErrorMessage(error);
  const translatedMessage = t(userFriendlyMessage);
  const retryInfo = telemetryService.isRetryableError(error);

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    }
  };

  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
    } else {
      window.location.reload();
    }
  };

  const handleRephrase = () => {
    if (onRephrase) {
      onRephrase();
    }
  };

  const handleReportIssue = () => {
    if (onReportIssue) {
      onReportIssue();
    } else {
      // Default report issue behavior
      telemetryService.reportError(error, {
        ...context,
        action: 'user_reported_issue'
      });
    }
  };

  const getMessageBarType = (): MessageBarType => {
    const severity = telemetryService.categorizeErrorSeverity(error);
    switch (severity) {
      case 'critical':
        return MessageBarType.severeWarning;
      case 'high':
        return MessageBarType.error;
      case 'medium':
        return MessageBarType.warning;
      default:
        return MessageBarType.info;
    }
  };

  return (
    <div className={styles.errorDisplay}>
      <MessageBar
        messageBarType={getMessageBarType()}
        isMultiline={true}
        className={styles.errorMessage}
      >
        <Stack horizontal className={styles.errorHeader}>
          <ErrorCircleRegular className={styles.errorIcon} />
          <span className={styles.errorText}>{translatedMessage}</span>
        </Stack>
      </MessageBar>

      <Stack horizontal className={styles.actionButtons} tokens={{ childrenGap: 8 }}>
        {showRetry && retryInfo.isRetryable && (
          <PrimaryButton
            text={t('Try Again')}
            onClick={handleRetry}
            className={styles.retryButton}
          />
        )}
        
        {showRephrase && (
          <DefaultButton
            text={t('Rephrase Question')}
            onClick={handleRephrase}
            className={styles.actionButton}
          />
        )}
        
        {showRefresh && (
          <DefaultButton
            text={t('Refresh Page')}
            onClick={handleRefresh}
            className={styles.actionButton}
          />
        )}
        
        {showReportIssue && (
          <DefaultButton
            text={t('Report Issue')}
            onClick={handleReportIssue}
            className={styles.reportButton}
          />
        )}
      </Stack>

      {retryInfo.isRetryable && retryInfo.maxRetries && (
        <div className={styles.retryInfo}>
          <span className={styles.retryText}>
            {t('This error can be automatically retried')} ({retryInfo.maxRetries} {t('attempts remaining')})
          </span>
        </div>
      )}
    </div>
  );
};
