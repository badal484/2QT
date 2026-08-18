import React from 'react';
import { NativeModules } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { getSocket, connectSocket, disconnectSocket } from '../socket/client';
import { RootState } from '../store';
import { updateUser } from '../store/slices/authSlice';
import { setFeatures } from '../store/slices/appSlice';
import AuthNavigator from './AuthNavigator';
import CustomerNavigator from './CustomerNavigator';
import RiderNavigator from './RiderNavigator';
import KitchenNavigator from './KitchenNavigator';
import AdminNavigator from './AdminNavigator';
import PartnerNavigator from './PartnerNavigator';
import ForceUpdateScreen from '../screens/ForceUpdateScreen';
import MaintenanceScreen from '../screens/MaintenanceScreen';
import { APP_VERSION, api } from '../api/client';
import { navigationRef, flushPendingNav } from './navigationRef';
import { tokens } from '../theme/tokens';

const { RoleModule } = NativeModules;
const BUILD_ROLE = RoleModule?.BUILD_ROLE;
console.log('--- DETECTED BUILD ROLE:', BUILD_ROLE);

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

  // One-time setup: system status
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
        if (status.featureLoyalty !== undefined) {
          dispatch(setFeatures({
            loyalty: status.featureLoyalty,
            referrals: status.featureReferrals
          }));
        }
      } catch (err) {
        console.warn('--- SYSTEM CHECK FAILED --- (Server might be offline)', err);
      }
    };
    checkSystemStatus();
  }, []);

  const isAuthenticated = !!accessToken;

  // The backend issues 2h access tokens that get silently refreshed by the API
  // client on any 401. accessToken's *value* therefore changes every ~2h even
  // though the session itself hasn't ended. Keep the latest value in a ref so
  // the socket-connect effect below can read it without depending on it —
  // depending on it directly used to tear down and recreate the Socket object
  // on every refresh, silently orphaning every listener bound to the old one
  // (GlobalSocketListener, RiderHomeScreen's order feed, AssignedOrderScreen's
  // status feed) since none of them ever re-attach to the new instance.
  const accessTokenRef = React.useRef(accessToken);
  React.useEffect(() => { accessTokenRef.current = accessToken; }, [accessToken]);

  // Socket connection — connects once per login session, not once per token refresh.
  React.useEffect(() => {
    if (!isAuthenticated) {
      disconnectSocket();
      return;
    }

    console.log('--- INITIALIZING SOCKET CONNECTION ---');
    connectSocket(accessTokenRef.current!);
    const socket = getSocket();

    const handleUserUpdated = (data: any) => {
      console.log('--- SYSTEMATIC USER UPDATE RECEIVED ---', data);
      dispatch(updateUser(data));
    };
    socket?.on('user_updated', handleUserUpdated);

    return () => {
      // Remove only our own handler — a bare .off('user_updated') here would
      // also strip GlobalSocketListener's handler for the same event.
      socket?.off('user_updated', handleUserUpdated);
      disconnectSocket();
    };
  }, [isAuthenticated, dispatch]);

  // Keep the live socket's auth payload current on token refresh, without
  // tearing down the connection — only used if socket.io ever needs to
  // reconnect (e.g. after a network drop), so it authenticates with a fresh token.
  React.useEffect(() => {
    if (!isAuthenticated) return;
    const socket = getSocket();
    if (socket) socket.auth = { token: accessToken };
  }, [accessToken, isAuthenticated]);

  // Push notification registration — keyed on login state, not on token value,
  // so it doesn't re-run (and re-register the device token) on every refresh.
  React.useEffect(() => {
    const { FCMService } = require('../services/fcm.service');
    if (!isAuthenticated) {
      FCMService.deactivateDeviceToken(user?.role);
      return;
    }

    const { NotificationHandler } = require('../services/notificationHandler');
    FCMService.registerDeviceToken(user?.role);
    const unsubscribeRefresh = FCMService.setupTokenRefreshListener(user?.role);
    const unsubscribeNotif = NotificationHandler.setupListeners(navigationRef.current);

    return () => {
      if (unsubscribeRefresh) unsubscribeRefresh();
      if (unsubscribeNotif) unsubscribeNotif();
    };
  }, [isAuthenticated, user?.role]);

  if (isMaintenance) return <MaintenanceScreen />;
  if (forceUpdateRequired) return <ForceUpdateScreen />;

  const activeRole = BUILD_ROLE || user?.role;

  return (
    <NavigationContainer 
      ref={navigationRef} 
      linking={linking as any} 
      onReady={flushPendingNav}
      theme={{
        ...DefaultTheme,
        dark: false,
        colors: {
          ...DefaultTheme.colors,
          primary: tokens.colors.primary,
          background: tokens.colors.background,
          card: tokens.colors.surface,
          text: tokens.colors.textPrimary,
          border: tokens.colors.border,
          notification: tokens.colors.primary,
        },
      }}
    >
      {!user ? (
        <AuthNavigator />
      ) : (activeRole === 'customer' || activeRole === 'buyer') ? (
        <CustomerNavigator />
      ) : (activeRole === 'rider' || activeRole === 'rider_captain') ? (
        <RiderNavigator />
      ) : (['chef', 'kitchen_manager', 'partner_kitchen', 'kitchen', 'dine_in_staff', 'packer'].includes(activeRole)) ? (
        <KitchenNavigator />
      ) : (activeRole === 'partner') ? (
        <PartnerNavigator />
      ) : (
        <AdminNavigator />
      )}
    </NavigationContainer>
  );
};

export default RootNavigator;
