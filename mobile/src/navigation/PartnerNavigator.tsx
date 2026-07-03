import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LayoutDashboard, CalendarDays, UtensilsCrossed, IndianRupee } from 'lucide-react-native';
import PartnerDashboardScreen from '../screens/partner/PartnerDashboardScreen';
import PartnerBookingsScreen from '../screens/partner/PartnerBookingsScreen';
import PartnerMenuScreen from '../screens/partner/PartnerMenuScreen';
import PartnerEarningsScreen from '../screens/partner/PartnerEarningsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const PRIMARY = '#1B5E46';

const MainPartnerTabs = () => (
  <Tab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarStyle: {
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        height: 70,
        paddingBottom: 12,
        paddingTop: 10,
      },
      tabBarActiveTintColor: PRIMARY,
      tabBarInactiveTintColor: '#9CA3AF',
      tabBarLabelStyle: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      },
    }}
  >
    <Tab.Screen
      name="PartnerHome"
      component={PartnerDashboardScreen}
      options={{
        tabBarLabel: 'Dashboard',
        tabBarIcon: ({ color }) => <LayoutDashboard size={22} color={color} />,
      }}
    />
    <Tab.Screen
      name="PartnerBookingsList"
      component={PartnerBookingsScreen}
      options={{
        tabBarLabel: 'Bookings',
        tabBarIcon: ({ color }) => <CalendarDays size={22} color={color} />,
      }}
    />
    <Tab.Screen
      name="PartnerMenuList"
      component={PartnerMenuScreen}
      options={{
        tabBarLabel: 'Menu',
        tabBarIcon: ({ color }) => <UtensilsCrossed size={22} color={color} />,
      }}
    />
    <Tab.Screen
      name="PartnerEarningsList"
      component={PartnerEarningsScreen}
      options={{
        tabBarLabel: 'Earnings',
        tabBarIcon: ({ color }) => <IndianRupee size={22} color={color} />,
      }}
    />
  </Tab.Navigator>
);

const PartnerNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right', animationDuration: 200 }}>
    <Stack.Screen name="MainPartner" component={MainPartnerTabs} />
  </Stack.Navigator>
);

export default PartnerNavigator;
