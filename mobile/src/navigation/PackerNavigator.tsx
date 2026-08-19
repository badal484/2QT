import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PackerScreen from '../screens/PackerScreen';

const Stack = createNativeStackNavigator();

const PackerNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right', animationDuration: 200 }}>
      <Stack.Screen name="PackerMain" component={PackerScreen} />
    </Stack.Navigator>
  );
};

export default PackerNavigator;
