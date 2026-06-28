import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import KitchenBoardScreen from '../screens/KitchenBoardScreen';
import StockScreen from '../screens/StockScreen';
import FeedbackScreen from '../screens/FeedbackScreen';
import ShiftHandoverScreen from '../screens/ShiftHandoverScreen';
import { ClipboardList, BarChart3, Star } from 'lucide-react-native';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const MainKitchenStack = () => (
  <Tab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarStyle: {
        backgroundColor: '#000',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)',
        height: 70,
        paddingBottom: 12,
        paddingTop: 12,
      },
      tabBarActiveTintColor: '#00D084',
      tabBarInactiveTintColor: 'rgba(255,255,255,0.3)',
      tabBarLabelStyle: {
        fontSize: 10,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 1,
      },
    }}
  >
    <Tab.Screen
      name="Board"
      component={KitchenBoardScreen}
      options={{ tabBarIcon: ({ color }) => <ClipboardList size={22} color={color} /> }}
    />
    <Tab.Screen
      name="Stock"
      component={StockScreen}
      options={{ tabBarIcon: ({ color }) => <BarChart3 size={22} color={color} /> }}
    />
    <Tab.Screen
      name="Ratings"
      component={FeedbackScreen}
      options={{ tabBarIcon: ({ color }) => <Star size={22} color={color} /> }}
    />
  </Tab.Navigator>
);

const KitchenNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right', animationDuration: 200 }}>
    <Stack.Screen name="MainKitchen" component={MainKitchenStack} />
    <Stack.Screen name="ShiftHandover" component={ShiftHandoverScreen} />
  </Stack.Navigator>
);

export default KitchenNavigator;
