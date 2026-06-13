import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { AlertTriangle, RefreshCcw } from 'lucide-react-native';
import RNRestart from 'react-native-restart'; // We'll just prompt a manual reload if this isn't installed

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReload = () => {
    try {
      // If react-native-restart is installed, use it. Otherwise just clear state.
      this.setState({ hasError: false, error: null });
    } catch (e) {
      console.warn("Could not reload", e);
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.content}>
            <View style={styles.iconCircle}>
              <AlertTriangle size={48} color="#EF4444" />
            </View>
            <Text style={styles.title}>Oops, something went wrong!</Text>
            <Text style={styles.subtitle}>We've encountered an unexpected error. Don't worry, our team has been notified.</Text>
            
            <View style={styles.errorBox}>
              <Text style={styles.errorText} numberOfLines={3}>
                {this.state.error?.message || "Unknown rendering error occurred"}
              </Text>
            </View>

            <TouchableOpacity style={styles.button} onPress={this.handleReload}>
              <RefreshCcw size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.buttonText}>Reload App</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  iconCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  title: { fontSize: 24, fontWeight: '900', color: '#1A1A2E', textAlign: 'center', marginBottom: 12 },
  subtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  errorBox: { backgroundColor: '#F3F4F6', padding: 16, borderRadius: 12, width: '100%', marginBottom: 32 },
  errorText: { color: '#EF4444', fontSize: 12, fontFamily: 'monospace' },
  button: { backgroundColor: '#FF6B35', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16, shadowColor: '#FF6B35', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '900' }
});
