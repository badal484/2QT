import React, { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket } from './client';
import { playKitchenAlert } from '../utils/kitchenAlert';

export const GlobalSocketListener: React.FC = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const attach = () => {
      const socket = getSocket();
      if (!socket) return null;

      // ── Orders ──────────────────────────────────────────────────────────────
      const handleOrderUpdate = () => {
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        queryClient.invalidateQueries({ queryKey: ['order'] });
        queryClient.invalidateQueries({ queryKey: ['activeOrders'] });
        queryClient.invalidateQueries({ queryKey: ['scheduledOrders'] });
        queryClient.invalidateQueries({ queryKey: ['rider-active-order'] });
      };

      const handleNewOrder = () => {
        playKitchenAlert();
        handleOrderUpdate();
      };

      // ── Menu, categories, offers ───────────────────────────────────────────
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

      // ── Wallet / finance ───────────────────────────────────────────────────
      const handleWalletUpdate = () => {
        queryClient.invalidateQueries({ queryKey: ['wallet'] });
      };

      const handleEarningsUpdate = () => {
        queryClient.invalidateQueries({ queryKey: ['earnings'] });
        queryClient.invalidateQueries({ queryKey: ['wallet'] });
        queryClient.invalidateQueries({ queryKey: ['riderPayouts'] });
      };

      const handlePayoutFailed = () => {
        queryClient.invalidateQueries({ queryKey: ['riderPayouts'] });
        queryClient.invalidateQueries({ queryKey: ['earnings'] });
      };

      const handleDocumentReview = () => {
        queryClient.invalidateQueries({ queryKey: ['profile'] });
        queryClient.invalidateQueries({ queryKey: ['user'] });
      };

      const handleRefundCompleted = () => {
        queryClient.invalidateQueries({ queryKey: ['wallet'] });
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        queryClient.invalidateQueries({ queryKey: ['order'] });
      };

      const handleLoyaltyUpdate = () => {
        queryClient.invalidateQueries({ queryKey: ['loyalty'] });
      };

      const handleSubscriptionUpdate = () => {
        queryClient.invalidateQueries({ queryKey: ['subscription'] });
      };

      // ── User / profile ─────────────────────────────────────────────────────
      const handleUserUpdate = () => {
        queryClient.invalidateQueries({ queryKey: ['profile'] });
        queryClient.invalidateQueries({ queryKey: ['user'] });
      };

      const handleNotification = () => {
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      };

      const handleRiderWaiting = () => {
        queryClient.invalidateQueries({ queryKey: ['order'] });
        queryClient.invalidateQueries({ queryKey: ['activeOrders'] });
      };

      const handlePoolUpdate = () => {
        queryClient.invalidateQueries({ queryKey: ['rider-missions-pool'] });
      };

      // ── Reconnect: refetch everything so missed events don't leave gaps ─────
      const handleReconnect = () => {
        queryClient.invalidateQueries({ queryKey: ['menu'] });
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        queryClient.invalidateQueries({ queryKey: ['activeOrders'] });
        queryClient.invalidateQueries({ queryKey: ['wallet'] });
        queryClient.invalidateQueries({ queryKey: ['banners'] });
        queryClient.invalidateQueries({ queryKey: ['menuOffers'] });
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        queryClient.invalidateQueries({ queryKey: ['home'] });
        queryClient.invalidateQueries({ queryKey: ['rider-active-order'] });
        queryClient.invalidateQueries({ queryKey: ['rider-earnings'] });
        queryClient.invalidateQueries({ queryKey: ['rider-order-history'] });
      };

      // ── Bind ────────────────────────────────────────────────────────────────
      socket.on('new_order', handleNewOrder);
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
      socket.on('payout_failed', handlePayoutFailed);
      socket.on('document_review', handleDocumentReview);
      socket.on('refund_completed', handleRefundCompleted);
      socket.on('loyalty_updated', handleLoyaltyUpdate);
      socket.on('subscription_updated', handleSubscriptionUpdate);

      socket.on('user_updated', handleUserUpdate);
      socket.on('new_notification', handleNotification);
      socket.on('rider_waiting', handleRiderWaiting);
      socket.on('new_available_mission', handlePoolUpdate);

      socket.on('connect', handleReconnect);

      // Return detach function
      return () => {
        socket.off('new_order', handleNewOrder);
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
        socket.off('payout_failed', handlePayoutFailed);
        socket.off('document_review', handleDocumentReview);
        socket.off('refund_completed', handleRefundCompleted);
        socket.off('loyalty_updated', handleLoyaltyUpdate);
        socket.off('subscription_updated', handleSubscriptionUpdate);

        socket.off('user_updated', handleUserUpdate);
        socket.off('new_notification', handleNotification);
        socket.off('rider_waiting', handleRiderWaiting);
        socket.off('new_available_mission', handlePoolUpdate);

        socket.off('connect', handleReconnect);
      };
    };

    // GlobalSocketListener mounts before RootNavigator's connectSocket() effect
    // runs (sibling effects fire in DOM order). Retry once after 2s so the
    // navigator has time to call connectSocket and make the socket available.
    let detach = attach();
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    if (!detach) {
      retryTimer = setTimeout(() => {
        detach = attach();
      }, 2000);
    }

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      if (detach) detach();
    };
  }, [queryClient]);

  return null;
};
