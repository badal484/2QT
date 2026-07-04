import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import KitchenBoardScreen from '../screens/KitchenBoardScreen';
import StockScreen from '../screens/StockScreen';
import FeedbackScreen from '../screens/FeedbackScreen';
import ShiftHandoverScreen from '../screens/ShiftHandoverScreen';
import KitchenDineInScreen from '../screens/KitchenDineInScreen';
import { ClipboardList, BarChart3, Star, UtensilsCrossed } from 'lucide-react-native';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TAB_BAR_STYLE = {
  backgroundColor: '#000',
  borderTopWidth: 1,
  borderTopColor: 'rgba(255,255,255,0.05)',
  height: 70,
  paddingBottom: 12,
  paddingTop: 12,
};

const TAB_OPTIONS = {
  headerShown: false,
  tabBarStyle: TAB_BAR_STYLE,
  tabBarActiveTintColor: '#00D084',
  tabBarInactiveTintColor: 'rgba(255,255,255,0.3)',
  tabBarLabelStyle: {
    fontSize: 10,
    fontWeight: '900' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
};

const DineInOnlyStack = () => (
  <Tab.Navigator screenOptions={TAB_OPTIONS}>
    <Tab.Screen
      name="Dine-in"
      component={KitchenDineInScreen}
      options={{ tabBarIcon: ({ color }) => <UtensilsCrossed size={22} color={color} /> }}
    />
  </Tab.Navigator>
);

const MainKitchenStack = () => (
  <Tab.Navigator screenOptions={TAB_OPTIONS}>
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
    <Tab.Screen
      name="Dine-in"
      component={KitchenDineInScreen}
      options={{ tabBarIcon: ({ color }) => <UtensilsCrossed size={22} color={color} /> }}
    />
  </Tab.Navigator>
);

const KitchenNavigator = () => {
  const user = useSelector((state: RootState) => state.auth.user);
  const isDineInStaff = user?.role === 'dine_in_staff';

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right', animationDuration: 200 }}>
      <Stack.Screen
        name="MainKitchen"
        component={isDineInStaff ? DineInOnlyStack : MainKitchenStack}
      />
      <Stack.Screen name="ShiftHandover" component={ShiftHandoverScreen} />
    </Stack.Navigator>
  );
};

export default KitchenNavigator;
