import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSelector } from 'react-redux';
import { RootState } from '../store';

import HomeScreen from '../screens/HomeScreen';
import SearchScreen from '../screens/SearchScreen';
import ItemDetailScreen from '../screens/ItemDetailScreen';
import CartScreen from '../screens/CartScreen';
import AddressScreen from '../screens/AddressScreen';
import CheckoutScreen from '../screens/CheckoutScreen';
import OrderConfirmedScreen from '../screens/OrderConfirmedScreen';
import OrderPlacedScreen from '../screens/OrderPlacedScreen';
import RateOrderScreen from '../screens/RateOrderScreen';
import OrderHistoryScreen from '../screens/OrderHistoryScreen';
import ProfileScreen from '../screens/ProfileScreen';
import MyPlansScreen from '../screens/MyPlansScreen';
import ReferralScreen from '../screens/ReferralScreen';
import SupportScreen from '../screens/SupportScreen';
import SubscriptionDetailScreen from '../screens/SubscriptionDetailScreen';
import AddressBookScreen from '../screens/AddressBookScreen';
import WalletScreen from '../screens/WalletScreen';
import LoyaltyScreen from '../screens/LoyaltyScreen';
import HelpScreen from '../screens/HelpScreen';
import SubscriptionScreen from '../screens/SubscriptionScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import RenewSubscriptionScreen from '../screens/RenewSubscriptionScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import ScheduleOrderScreen from '../screens/ScheduleOrderScreen';
import LiveKitchenScreen from '../screens/LiveKitchenScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import CategoryScreen from '../screens/CategoryScreen';

const Stack = createNativeStackNavigator();

const CustomerNavigator = () => {
  const user = useSelector((state: RootState) => state.auth.user);
  const isNewUser = !user?.name || user?.name === '2QT User' || user?.name === '2QT_User';

  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, animation: 'slide_from_right', animationDuration: 200 }}
      initialRouteName={isNewUser ? 'Onboarding' : 'Home'}
    >
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="ItemDetail" component={ItemDetailScreen} options={{ animation: 'slide_from_bottom', animationDuration: 280, gestureDirection: 'vertical' }} />
      <Stack.Screen name="Cart" component={CartScreen} options={{ animation: 'slide_from_bottom', animationDuration: 280, gestureDirection: 'vertical' }} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} />
      <Stack.Screen name="Address" component={AddressScreen} />
      <Stack.Screen name="AddressBook" component={AddressBookScreen} />
      <Stack.Screen name="OrderPlaced" component={OrderPlacedScreen} />
      <Stack.Screen name="OrderConfirmed" component={OrderConfirmedScreen} />
      <Stack.Screen name="RateOrder" component={RateOrderScreen} options={{ animation: 'slide_from_bottom', animationDuration: 280, gestureDirection: 'vertical' }} />
      <Stack.Screen name="OrderHistory" component={OrderHistoryScreen} />
      <Stack.Screen name="OrdersTab" component={OrderHistoryScreen} />
      <Stack.Screen name="ScheduleOrder" component={ScheduleOrderScreen} />
      <Stack.Screen name="ProfileTab" component={ProfileScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="MyPlans" component={MyPlansScreen} />
      <Stack.Screen name="Referral" component={ReferralScreen} />
      <Stack.Screen name="Wallet" component={WalletScreen} />
      <Stack.Screen name="Loyalty" component={LoyaltyScreen} />
      <Stack.Screen name="Support" component={SupportScreen} />
      <Stack.Screen name="Help" component={HelpScreen} />
      <Stack.Screen name="Subscription" component={SubscriptionScreen} />
      <Stack.Screen name="SubscriptionDetail" component={SubscriptionDetailScreen} />
      <Stack.Screen name="RenewSubscription" component={RenewSubscriptionScreen} />
      <Stack.Screen name="LiveKitchen" component={LiveKitchenScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Category" component={CategoryScreen} />
    </Stack.Navigator>
  );
};

export default CustomerNavigator;
