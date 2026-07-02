import React, { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket } from './client';

export const GlobalSocketListener: React.FC = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // ── Orders ────────────────────────────────────────────────────────────────
    const handleOrderUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order'] });
      queryClient.invalidateQueries({ queryKey: ['activeOrders'] });
      queryClient.invalidateQueries({ queryKey: ['scheduledOrders'] });
    };

    // ── Menu, categories, offers ──────────────────────────────────────────────
    const handleMenuUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['menu'] });
      queryClient.invalidateQueries({ queryKey: ['menuCategories'] });
      queryClient.invalidateQueries({ queryKey: ['activePromos'] });
      queryClient.invalidateQueries({ queryKey: ['home'] });
    };

    const handleBannerUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['banners'] });
      queryClient.invalidateQueries({ queryKey: ['home'] });
    };

    const handleOfferUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['menuOffers'] });
      queryClient.invalidateQueries({ queryKey: ['menu'] });
      queryClient.invalidateQueries({ queryKey: ['home'] });
    };

    const handleCampaignUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['activePromos'] });
    };

    const handlePromoUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['activePromos'] });
    };

    const handleInventoryUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    };

    // ── Wallet / finance ──────────────────────────────────────────────────────
    const handleWalletUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
    };

    const handleEarningsUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['earnings'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['riderPayouts'] });
    };

    const handleLoyaltyUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['loyalty'] });
    };

    const handleSubscriptionUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    };

    // ── User / profile ────────────────────────────────────────────────────────
    const handleUserUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['user'] });
    };

    const handleNotification = () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };

    // ── Reconnect: refetch everything stale so missed events don't leave gaps ─
    const handleReconnect = () => {
      queryClient.invalidateQueries({ queryKey: ['menu'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['activeOrders'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['banners'] });
      queryClient.invalidateQueries({ queryKey: ['menuOffers'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['home'] });
    };

    // ── Bind ──────────────────────────────────────────────────────────────────
    socket.on('new_order', handleOrderUpdate);
    socket.on('order_status_update', handleOrderUpdate);
    socket.on('order_cancelled', handleOrderUpdate);
    socket.on('order_updated', handleOrderUpdate);

    socket.on('menu_updated', handleMenuUpdate);
    socket.on('kitchen_resumed', handleMenuUpdate);
    socket.on('banner_updated', handleBannerUpdate);
    socket.on('offer_updated', handleOfferUpdate);
    socket.on('campaign_updated', handleCampaignUpdate);
    socket.on('promo_updated', handlePromoUpdate);
    socket.on('inventory_updated', handleInventoryUpdate);

    socket.on('wallet_updated', handleWalletUpdate);
    socket.on('earnings_updated', handleEarningsUpdate);
    socket.on('loyalty_updated', handleLoyaltyUpdate);
    socket.on('subscription_updated', handleSubscriptionUpdate);

    socket.on('user_updated', handleUserUpdate);
    socket.on('new_notification', handleNotification);

    socket.on('connect', handleReconnect);

    return () => {
      socket.off('new_order', handleOrderUpdate);
      socket.off('order_status_update', handleOrderUpdate);
      socket.off('order_cancelled', handleOrderUpdate);
      socket.off('order_updated', handleOrderUpdate);

      socket.off('menu_updated', handleMenuUpdate);
      socket.off('kitchen_resumed', handleMenuUpdate);
      socket.off('banner_updated', handleBannerUpdate);
      socket.off('offer_updated', handleOfferUpdate);
      socket.off('campaign_updated', handleCampaignUpdate);
      socket.off('promo_updated', handlePromoUpdate);
      socket.off('inventory_updated', handleInventoryUpdate);

      socket.off('wallet_updated', handleWalletUpdate);
      socket.off('earnings_updated', handleEarningsUpdate);
      socket.off('loyalty_updated', handleLoyaltyUpdate);
      socket.off('subscription_updated', handleSubscriptionUpdate);

      socket.off('user_updated', handleUserUpdate);
      socket.off('new_notification', handleNotification);

      socket.off('connect', handleReconnect);
    };
  }, [queryClient]);

  return null;
};
