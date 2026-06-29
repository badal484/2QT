import React from 'react';
import { Alert, NativeModules } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { getSocket, connectSocket, disconnectSocket } from '../socket/client';
import { RootState } from '../store';
import { updateUser } from '../store/slices/authSlice';
import AuthNavigator from './AuthNavigator';
import CustomerNavigator from './CustomerNavigator';
import RiderNavigator from './RiderNavigator';
import KitchenNavigator from './KitchenNavigator';
import AdminNavigator from './AdminNavigator';
import ForceUpdateScreen from '../screens/ForceUpdateScreen';
import MaintenanceScreen from '../screens/MaintenanceScreen';
import { APP_VERSION, api } from '../api/client';
import { navigationRef, navigateFromNotification } from './navigationRef';
import {
  subscribeToNotificationTap,
  subscribeToForegroundMessages,
  handleInitialNotification,
  setupBackgroundHandler,
} from '../services/push';

const { RoleModule } = NativeModules;
const BUILD_ROLE = RoleModule?.BUILD_ROLE; // 'customer', 'rider', 'kitchen', 'admin' or undefined
console.log('--- DETECTED BUILD ROLE:', BUILD_ROLE);

// Must be called at module load time (before any component mounts)
setupBackgroundHandler();

const linking = {
  prefixes: ['2qt://', 'https://2qt.app'],
  config: {
    screens: {
      Home: 'home',
      Cart: 'cart',
      OrderPlaced: 'order/:orderId',
      OrderHistory: 'orders',
      RateOrder: 'rate/:orderId',
      Wallet: 'wallet',
      MyPlans: 'plans',
      Notifications: 'notifications',
      RiderOnboarding: 'rider/onboarding',
      RiderHome: 'rider/home',
      AssignedOrder: 'mission/:orderId',
      Payouts: 'rider/payouts',
    },
  },
};

const RootNavigator = () => {
  const { user, accessToken } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch();
  const [forceUpdateRequired, setForceUpdateRequired] = React.useState(false);
  const [isMaintenance, setIsMaintenance] = React.useState(false);

  React.useEffect(() => {
    const checkSystemStatus = async () => {
      try {
        const status = await api.get('/app/version');
        if (status.forceUpdate || (status.minRequiredVersion && status.minRequiredVersion > APP_VERSION)) {
          setForceUpdateRequired(true);
        }
        if (status.maintenanceMode) {
          setIsMaintenance(true);
        }
      } catch (err) {
        console.warn('--- SYSTEM CHECK FAILED --- (Server might be offline)', err);
      }
    };
    checkSystemStatus();
  }, []);

  // Wire notification handlers once after NavigationContainer is ready
  React.useEffect(() => {
    const unsubTap = subscribeToNotificationTap();
    handleInitialNotification(); // handles killed-app launch via notification

    // Foreground: system won't show the notification — display an alert and navigate on "View"
    const unsubForeground = subscribeToForegroundMessages((title, body, data) => {
      Alert.alert(title, body, [
        { text: 'Dismiss', style: 'cancel' },
        { text: 'View', onPress: () => navigateFromNotification(data) },
      ]);
    });

    return () => { unsubTap(); unsubForeground(); };
  }, []);

  React.useEffect(() => {
    if (accessToken) {
      console.log('--- INITIALIZING SOCKET CONNECTION ---');
      connectSocket(accessToken);

      const socket = getSocket();
      if (socket) {
        socket.on('user_updated', (data) => {
          console.log('--- SYSTEMATIC USER UPDATE RECEIVED ---', data);
          dispatch(updateUser(data));
        });
      }
    } else {
      disconnectSocket();
    }
    return () => {
      const socket = getSocket();
      if (socket) socket.off('user_updated');
      disconnectSocket();
    };
  }, [accessToken, dispatch]);

  if (isMaintenance) return <MaintenanceScreen />;
  if (forceUpdateRequired) return <ForceUpdateScreen />;

  const activeRole = BUILD_ROLE || user?.role;

  return (
    <NavigationContainer ref={navigationRef} linking={linking as any}>
      {!user ? (
        <AuthNavigator />
      ) : (activeRole === 'customer' || activeRole === 'buyer') ? (
        <CustomerNavigator />
      ) : (activeRole === 'rider' || activeRole === 'rider_captain') ? (
        <RiderNavigator />
      ) : (['chef', 'kitchen_manager', 'partner_kitchen', 'kitchen'].includes(activeRole)) ? (
        <KitchenNavigator />
      ) : (
        <AdminNavigator />
      )}
    </NavigationContainer>
  );
};

export default RootNavigator;
