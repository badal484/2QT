import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Text } from 'react-native';
import KitchenBoardScreen from '../screens/KitchenBoardScreen';
import BatchViewScreen from '../screens/BatchViewScreen';
import MorningPrepScreen from '../screens/MorningPrepScreen';
import StockScreen from '../screens/StockScreen';
import FeedbackScreen from '../screens/FeedbackScreen';
import ShiftHandoverScreen from '../screens/ShiftHandoverScreen';
import CreateBatchScreen from '../screens/CreateBatchScreen';

import { ClipboardList, Package, ChefHat, BarChart3, Star } from 'lucide-react-native';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

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
      tabBarActiveTintColor: '#FF6B35',
      tabBarInactiveTintColor: 'rgba(255,255,255,0.3)',
      tabBarLabelStyle: {
        fontSize: 10,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 1,
      }
    }}
  >
    <Tab.Screen 
      name="Board" 
      component={KitchenBoardScreen} 
      options={{ tabBarIcon: ({ color }) => <ClipboardList size={22} color={color} /> }}
    />
    <Tab.Screen 
      name="Batch" 
      component={BatchViewScreen} 
      options={{ tabBarIcon: ({ color }) => <ChefHat size={22} color={color} /> }}
    />
    <Tab.Screen 
      name="Prep" 
      component={MorningPrepScreen} 
      options={{ tabBarIcon: ({ color }) => <Package size={22} color={color} /> }}
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

const KitchenNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainKitchen" component={MainKitchenStack} />
      <Stack.Screen name="ShiftHandover" component={ShiftHandoverScreen} />
      <Stack.Screen name="CreateBatch" component={CreateBatchScreen} />
    </Stack.Navigator>
  );
};

export default KitchenNavigator;
