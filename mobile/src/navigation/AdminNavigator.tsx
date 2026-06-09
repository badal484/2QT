import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Text } from 'react-native';
import DashboardScreen from '../screens/admin/DashboardScreen';
import LiveOrdersScreen from '../screens/admin/LiveOrdersScreen';
import RiderStatusScreen from '../screens/admin/RiderStatusScreen';
import AdminPayoutsScreen from '../screens/admin/AdminPayoutsScreen';
import TicketsScreen from '../screens/admin/TicketsScreen';
import BroadcastScreen from '../screens/admin/BroadcastScreen';
import MenuManagerScreen from '../screens/admin/MenuManagerScreen';
import AdminOrderDetailScreen from '../screens/admin/AdminOrderDetailScreen';
import AddEditMenuItemScreen from '../screens/admin/AddEditMenuItemScreen';
import UserManagementScreen from '../screens/admin/UserManagementScreen';
import TicketDetailScreen from '../screens/admin/TicketDetailScreen';
import StockScreen from '../screens/StockScreen';

import { LayoutDashboard, ShoppingBag, Truck, IndianRupee, Headphones } from 'lucide-react-native';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const MainAdminStack = () => (
  <Tab.Navigator 
    screenOptions={{ 
      headerShown: false,
      tabBarStyle: {
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        height: 75,
        paddingBottom: 15,
        paddingTop: 10,
      },
      tabBarActiveTintColor: '#FF6B35',
      tabBarInactiveTintColor: '#999',
      tabBarLabelStyle: {
        fontSize: 10,
        fontWeight: '800',
      }
    }}
  >
    <Tab.Screen 
      name="Dashboard" 
      component={DashboardScreen} 
      options={{ tabBarIcon: ({ color }) => <LayoutDashboard size={22} color={color} /> }}
    />
    <Tab.Screen 
      name="Orders" 
      component={LiveOrdersScreen} 
      options={{ tabBarIcon: ({ color }) => <ShoppingBag size={22} color={color} /> }}
    />
    <Tab.Screen 
      name="Riders" 
      component={RiderStatusScreen} 
      options={{ tabBarIcon: ({ color }) => <Truck size={22} color={color} /> }}
    />
    <Tab.Screen 
      name="Payouts" 
      component={AdminPayoutsScreen} 
      options={{ tabBarIcon: ({ color }) => <IndianRupee size={22} color={color} /> }}
    />
    <Tab.Screen 
      name="Support" 
      component={TicketsScreen} 
      options={{ tabBarIcon: ({ color }) => <Headphones size={22} color={color} /> }}
    />
  </Tab.Navigator>
);

const AdminNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainAdmin" component={MainAdminStack} />
      <Stack.Screen name="Broadcast" component={BroadcastScreen} />
      <Stack.Screen name="MenuManager" component={MenuManagerScreen} />
      <Stack.Screen name="AdminOrderDetail" component={AdminOrderDetailScreen} />
      <Stack.Screen name="AddEditMenuItem" component={AddEditMenuItemScreen} />
      <Stack.Screen name="UserManagement" component={UserManagementScreen} />
      <Stack.Screen name="TicketDetail" component={TicketDetailScreen} />
      <Stack.Screen name="Stock" component={StockScreen} />
    </Stack.Navigator>
  );
};

export default AdminNavigator;
