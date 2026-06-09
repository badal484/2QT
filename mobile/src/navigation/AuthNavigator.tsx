import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { NativeModules } from 'react-native';
import OnboardingScreen from '../screens/OnboardingScreen';
import LoginScreen from '../screens/LoginScreen';
import OTPScreen from '../screens/OTPScreen';
import KitchenLoginScreen from '../screens/KitchenLoginScreen';

const { RoleModule } = NativeModules;
const BUILD_ROLE = RoleModule?.BUILD_ROLE;

const Stack = createStackNavigator();

const AuthNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {BUILD_ROLE === 'kitchen' ? (
        <Stack.Screen name="KitchenLogin" component={KitchenLoginScreen} />
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="OTP" component={OTPScreen} />
        </>
      )}
    </Stack.Navigator>
  );
};

export default AuthNavigator;
