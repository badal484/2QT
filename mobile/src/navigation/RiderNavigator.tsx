import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RiderTabNavigator } from './RiderTabNavigator';
import AssignedOrderScreen from '../screens/AssignedOrderScreen';
import DeliveryOTPScreen from '../screens/DeliveryOTPScreen';
import DoorPaymentScreen from '../screens/DoorPaymentScreen';
import CashSubmitScreen from '../screens/CashSubmitScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import RiderOnboardingScreen from '../screens/RiderOnboardingScreen';
import PayoutsScreen from '../screens/PayoutsScreen';
import RiderDocumentsScreen from '../screens/RiderDocumentsScreen';
import RiderMissionsScreen from '../screens/RiderMissionsScreen';
import RiderNotificationsScreen from '../screens/RiderNotificationsScreen';
import RiderHelpScreen from '../screens/RiderHelpScreen';
import RiderSupportScreen from '../screens/RiderSupportScreen';
import RiderScorecardScreen from '../screens/RiderScorecardScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import VerificationPendingScreen from '../screens/VerificationPendingScreen';
import { useSelector } from 'react-redux';
import { RootState } from '../store';

const Stack = createNativeStackNavigator();

const RiderNavigator = () => {
  const user = useSelector((state: RootState) => state.auth.user);
  const onboardingComplete = user?.onboarding_complete ?? false;
  const isVerified = user?.is_verified ?? false;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right', animationDuration: 200 }}>
      {!onboardingComplete ? (
        <>
          <Stack.Screen name="RiderOnboarding" component={RiderOnboardingScreen} />
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="RiderDocuments" component={RiderDocumentsScreen} />
        </>
      ) : !isVerified ? (
        <>
          <Stack.Screen name="VerificationPending" component={VerificationPendingScreen} />
          <Stack.Screen name="RiderDocuments" component={RiderDocumentsScreen} />
        </>
      ) : (
        <>
          {/* Tab root — always the base */}
          <Stack.Screen name="RiderTabs" component={RiderTabNavigator} options={{ animation: 'none' }} />

          {/* Full-screen flows pushed on top of tabs */}
          <Stack.Screen name="AssignedOrder" component={AssignedOrderScreen} />
          <Stack.Screen name="DoorPayment" component={DoorPaymentScreen} />
          <Stack.Screen name="DeliveryOTP" component={DeliveryOTPScreen} />
          <Stack.Screen name="CashSubmit" component={CashSubmitScreen} />
          <Stack.Screen name="Payouts" component={PayoutsScreen} />
          <Stack.Screen name="RiderDocuments" component={RiderDocumentsScreen} />
          <Stack.Screen name="RiderMissions" component={RiderMissionsScreen} />
          <Stack.Screen name="RiderNotifications" component={RiderNotificationsScreen} />
          <Stack.Screen name="RiderHelp" component={RiderHelpScreen} />
          <Stack.Screen name="RiderSupport" component={RiderSupportScreen} />
          <Stack.Screen name="RiderScorecard" component={RiderScorecardScreen} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        </>
      )}
    </Stack.Navigator>
  );
};

export default RiderNavigator;
