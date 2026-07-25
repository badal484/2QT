import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './src/store/index';
import RootNavigator from './src/navigation/RootNavigator';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { NetworkObserver } from './src/components/NetworkObserver';
import { AppBootManager } from './src/components/AppBootManager';
import SplashScreen from './src/screens/SplashScreen';
import { GlobalSocketListener } from './src/socket/GlobalSocketListener';
import { Toast } from './src/components/ui/Toast';
import { useAppStateFocusManager } from './src/hooks/useAppStateFocusManager';

if (!__DEV__) {
  console.log = () => {};
  console.warn = () => {};
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,        // 5 min — don't refetch on every focus
      gcTime: 30 * 60 * 1000,           // 30 min in memory
      retry: 1,
      retryDelay: 1000,
      placeholderData: (prev: any) => prev, // show stale data instantly on re-visit, never blank
    },
  },
});

const App = () => {
  useAppStateFocusManager();
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#FAF8F4' }}>
      <SafeAreaProvider>
        <Provider store={store}>
          <PersistGate loading={<SplashScreen />} persistor={persistor}>
            <QueryClientProvider client={queryClient}>
              <ErrorBoundary>
                <NetworkObserver />
                <GlobalSocketListener />
                <AppBootManager>
                  <RootNavigator />
                </AppBootManager>
                <Toast />
              </ErrorBoundary>
            </QueryClientProvider>
          </PersistGate>
        </Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default App;
