import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { AlertTriangle, RefreshCcw } from 'lucide-react-native';
import * as Sentry from '@sentry/react-native';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
  screenName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught exception:', error, errorInfo);

    Sentry.captureException(error, {
      extra: {
        componentStack: errorInfo.componentStack,
        screenName: this.props.screenName || 'UnknownScreen',
      },
    });
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.content}>
            <View style={styles.iconCircle}>
              <AlertTriangle size={48} color="#EF4444" />
            </View>
            <Text style={styles.title}>Oops, something went wrong!</Text>
            <Text style={styles.subtitle}>
              We've encountered an unexpected issue. Our engineering team has been notified.
            </Text>

            <View style={styles.errorBox}>
              <Text style={styles.errorText} numberOfLines={3}>
                {this.state.error?.message || 'Unknown rendering error occurred'}
              </Text>
            </View>

            <TouchableOpacity style={styles.button} onPress={this.handleReload} activeOpacity={0.85}>
              <RefreshCcw size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.buttonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF8F4' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: { fontSize: 22, fontWeight: '900', color: '#1B5E46', textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  errorBox: {
    backgroundColor: '#F3F4F6',
    padding: 14,
    borderRadius: 12,
    width: '100%',
    marginBottom: 28,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  errorText: { color: '#DC2626', fontSize: 12, fontFamily: 'monospace' },
  button: {
    backgroundColor: '#1B5E46',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: '#1B5E46',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
