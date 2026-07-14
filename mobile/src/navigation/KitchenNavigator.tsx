import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import KitchenBoardScreen from '../screens/KitchenBoardScreen';
import StockScreen from '../screens/StockScreen';
import KitchenManageScreen from '../screens/KitchenManageScreen';
import FeedbackScreen from '../screens/FeedbackScreen';
import ShiftHandoverScreen from '../screens/ShiftHandoverScreen';
import KitchenDineInScreen from '../screens/KitchenDineInScreen';
import PackerScreen from '../screens/PackerScreen';
import { ClipboardList, BarChart3, Star, UtensilsCrossed, Settings } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const MainKitchenTabs = () => {
  const user = useSelector((state: RootState) => state.auth.user);
  const isDineInStaff = user?.role === 'dine_in_staff';
  const insets = useSafeAreaInsets();

  const tabOptions = {
    headerShown: false,
    tabBarStyle: {
      backgroundColor: '#000000',
      borderTopWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.05)',
      height: 60 + (insets.bottom > 0 ? insets.bottom : 10),
      paddingBottom: insets.bottom > 0 ? insets.bottom : 10,
      paddingTop: 10,
    },
    tabBarActiveTintColor: '#00D084',
    tabBarInactiveTintColor: '#9CA3AF',
    tabBarLabelStyle: {
      fontSize: 10,
      fontWeight: '700' as const,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.5,
    },
  };

  return (
    <Tab.Navigator screenOptions={tabOptions}>
      {!isDineInStaff && (
        <Tab.Screen
          name="Board"
          component={KitchenBoardScreen}
          options={{ tabBarIcon: ({ color }) => <ClipboardList size={22} color={color} strokeWidth={2} /> }}
        />
      )}
      {!isDineInStaff && (
        <Tab.Screen
          name="Manage"
          component={KitchenManageScreen}
          options={{ tabBarIcon: ({ color }) => <Settings size={22} color={color} strokeWidth={2} /> }}
        />
      )}
      {!isDineInStaff && (
        <Tab.Screen
          name="Stock"
          component={StockScreen}
          options={{ tabBarIcon: ({ color }) => <BarChart3 size={22} color={color} strokeWidth={2} /> }}
        />
      )}
      {!isDineInStaff && (
        <Tab.Screen
          name="Ratings"
          component={FeedbackScreen}
          options={{ tabBarIcon: ({ color }) => <Star size={22} color={color} strokeWidth={2} /> }}
        />
      )}
      <Tab.Screen
        name="Dine-in"
        component={KitchenDineInScreen}
        options={{ tabBarIcon: ({ color }) => <UtensilsCrossed size={22} color={color} strokeWidth={2} /> }}
      />
    </Tab.Navigator>
  );
};

// Packer gets a standalone fullscreen — no tabs, no distractions
const PackerStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="PackerMain" component={PackerScreen} />
  </Stack.Navigator>
);

const KitchenNavigator = () => {
  const user = useSelector((state: RootState) => state.auth.user);
  const isPacker = user?.role === 'packer';

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right', animationDuration: 200 }}>
      {isPacker ? (
        <Stack.Screen name="PackerRoot" component={PackerStack} />
      ) : (
        <>
          <Stack.Screen name="MainKitchen" component={MainKitchenTabs} />
          <Stack.Screen name="ShiftHandover" component={ShiftHandoverScreen} />
        </>
      )}
    </Stack.Navigator>
  );
};

export default KitchenNavigator;
