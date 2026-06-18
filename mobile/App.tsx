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

console.log('--- 2QT SYSTEM INITIALIZING ---');
console.log('STORE_STATUS:', !!store);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      retry: false,
    },
  },
});

const App = () => {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Provider store={store}>
          <PersistGate loading={<SplashScreen />} persistor={persistor}>
            <QueryClientProvider client={queryClient}>
              <ErrorBoundary>
                <NetworkObserver />
                <AppBootManager>
                  <RootNavigator />
                </AppBootManager>
              </ErrorBoundary>
            </QueryClientProvider>
          </PersistGate>
        </Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default App;
