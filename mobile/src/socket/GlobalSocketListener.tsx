import React, { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket } from './client';

export const GlobalSocketListener: React.FC = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleOrderUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order'] }); // Invalidates all ['order', id]
      queryClient.invalidateQueries({ queryKey: ['activeOrders'] });
      queryClient.invalidateQueries({ queryKey: ['scheduledOrders'] });
    };

    const handleMenuUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['menu'] });
      queryClient.invalidateQueries({ queryKey: ['menuCategories'] });
      queryClient.invalidateQueries({ queryKey: ['activePromos'] });
    };

    const handleWalletUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
    };

    const handleLoyaltyUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['loyalty'] });
    };

    const handleSubscriptionUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    };

    const handleUserUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['user'] });
    };

    const handleNotification = () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };

    const handleInventoryUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    };
    
    const handlePromoUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['activePromos'] });
    };

    socket.on('new_order', handleOrderUpdate);
    socket.on('order_status_update', handleOrderUpdate);
    socket.on('order_cancelled', handleOrderUpdate);
    socket.on('order_updated', handleOrderUpdate);
    
    socket.on('menu_updated', handleMenuUpdate);
    socket.on('inventory_updated', handleInventoryUpdate);
    socket.on('promo_updated', handlePromoUpdate);

    socket.on('wallet_updated', handleWalletUpdate);
    socket.on('loyalty_updated', handleLoyaltyUpdate);
    socket.on('subscription_updated', handleSubscriptionUpdate);
    
    socket.on('user_updated', handleUserUpdate);
    socket.on('new_notification', handleNotification);

    return () => {
      socket.off('new_order', handleOrderUpdate);
      socket.off('order_status_update', handleOrderUpdate);
      socket.off('order_cancelled', handleOrderUpdate);
      socket.off('order_updated', handleOrderUpdate);
      
      socket.off('menu_updated', handleMenuUpdate);
      socket.off('inventory_updated', handleInventoryUpdate);
      socket.off('promo_updated', handlePromoUpdate);
      
      socket.off('wallet_updated', handleWalletUpdate);
      socket.off('loyalty_updated', handleLoyaltyUpdate);
      socket.off('subscription_updated', handleSubscriptionUpdate);
      
      socket.off('user_updated', handleUserUpdate);
      socket.off('new_notification', handleNotification);
    };
  }, [queryClient]);

  // Headless component, renders nothing
  return null;
};
