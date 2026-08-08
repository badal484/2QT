import * as Sentry from '@sentry/react-native';
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

Sentry.init({
  dsn: 'https://b5d670f640f89928714224c3d20458f3@o4511873871642624.ingest.us.sentry.io/4511873899167744',
  environment: __DEV__ ? 'development' : 'production',
  enableNativeNagger: false,
  tracesSampleRate: __DEV__ ? 0 : 0.2,
});

if (!__DEV__) {
  console.log = () => {};
  console.warn = () => {};
}

import { FeedbackProvider } from './src/context/FeedbackContext';

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
                <FeedbackProvider>
                  <NetworkObserver />
                  <GlobalSocketListener />
                  <AppBootManager>
                    <RootNavigator />
                  </AppBootManager>
                  <Toast />
                </FeedbackProvider>
              </ErrorBoundary>
            </QueryClientProvider>
          </PersistGate>
        </Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default Sentry.wrap(App);
