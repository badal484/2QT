import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import RiderHomeScreen from '../screens/RiderHomeScreen';
import AssignedOrderScreen from '../screens/AssignedOrderScreen';
import DeliveryOTPScreen from '../screens/DeliveryOTPScreen';
import DoorPaymentScreen from '../screens/DoorPaymentScreen';
import CashSubmitScreen from '../screens/CashSubmitScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import PayoutsScreen from '../screens/PayoutsScreen';
import EarningsScreen from '../screens/EarningsScreen';
import RiderHistoryScreen from '../screens/RiderHistoryScreen';
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
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      ) : !isVerified ? (
        <Stack.Screen name="VerificationPending" component={VerificationPendingScreen} />
      ) : (
        <>
          <Stack.Screen name="RiderHome" component={RiderHomeScreen} />
          <Stack.Screen name="AssignedOrder" component={AssignedOrderScreen} />
          <Stack.Screen name="DoorPayment" component={DoorPaymentScreen} />
          <Stack.Screen name="DeliveryOTP" component={DeliveryOTPScreen} />
          <Stack.Screen name="CashSubmit" component={CashSubmitScreen} />
          <Stack.Screen name="Payouts" component={PayoutsScreen} />
          <Stack.Screen name="Earnings" component={EarningsScreen} />
          <Stack.Screen name="RiderHistory" component={RiderHistoryScreen} />
        </>
      )}
    </Stack.Navigator>
  );
};

export default RiderNavigator;
