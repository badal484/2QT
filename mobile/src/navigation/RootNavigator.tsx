import React from 'react';
import { NativeModules, Platform, PermissionsAndroid } from 'react-native';
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
import { navigationRef, flushPendingNav } from './navigationRef';
import {
  subscribeToNotificationTap,
  subscribeToForegroundMessages,
  handleInitialNotification,
  setupBackgroundHandler,
  registerDeviceToken,
  subscribeToTokenRefresh,
} from '../services/push';
import {
  createNotificationChannels,
  displayLocalNotification,
  setupNotifeeHandlers,
} from '../services/localNotif';

const { RoleModule } = NativeModules;
const BUILD_ROLE = RoleModule?.BUILD_ROLE;
console.log('--- DETECTED BUILD ROLE:', BUILD_ROLE);

// Must be called at module load time (before any component mounts)
setupBackgroundHandler();
setupNotifeeHandlers();

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

// Request POST_NOTIFICATIONS runtime permission (Android 13+) then register FCM token.
// Must be called after the user is authenticated so the token can be saved server-side.
async function requestPushPermissionAndRegister() {
  try {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      const status = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        {
          title: 'Allow Notifications',
          message: 'Enable notifications to get live order updates, delivery alerts and offers.',
          buttonPositive: 'Allow',
          buttonNegative: 'Not now',
        }
      );
      if (status !== PermissionsAndroid.RESULTS.GRANTED) {
        console.warn('[PUSH] POST_NOTIFICATIONS permission denied');
        return;
      }
    }
    // Permission granted (or iOS / Android < 13) — register FCM token
    await registerDeviceToken();
    console.log('[PUSH] Device token registered successfully');
  } catch (err) {
    console.warn('[PUSH] Permission/token error:', err);
  }
}

const RootNavigator = () => {
  const { user, accessToken } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch();
  const [forceUpdateRequired, setForceUpdateRequired] = React.useState(false);
  const [isMaintenance, setIsMaintenance] = React.useState(false);

  // One-time setup: notification channels + system status
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
    createNotificationChannels().catch(() => {});
  }, []);

  // Wire FCM tap and foreground message handlers
  React.useEffect(() => {
    const unsubTap = subscribeToNotificationTap();
    handleInitialNotification();

    // Foreground FCM → post real system notification via notifee (appears in tray)
    const unsubForeground = subscribeToForegroundMessages((title, body, data) => {
      displayLocalNotification(title, body, data).catch(() => {});
    });

    return () => { unsubTap(); unsubForeground(); };
  }, []);

  // When user logs in: request POST_NOTIFICATIONS permission then register FCM token.
  // Running this here (not in HomeScreen) means the permission dialog always appears
  // right after login, regardless of which screen the user lands on.
  React.useEffect(() => {
    if (!accessToken) return;
    requestPushPermissionAndRegister();
    const unsubRefresh = subscribeToTokenRefresh();
    return () => { unsubRefresh(); };
  }, [accessToken]);

  // Socket connection
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
    <NavigationContainer ref={navigationRef} linking={linking as any} onReady={flushPendingNav}>
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
