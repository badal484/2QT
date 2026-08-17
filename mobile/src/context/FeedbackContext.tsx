import React, { createContext, useContext, useState, useCallback, ReactNode, useRef } from 'react';
import { StyleSheet, View, Text, Modal, Pressable } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { tokens } from '../theme/tokens';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react-native';
import { haptics } from '../utils/haptics';
import { PressableScale } from '../components/ui/internal/PressableScale';

export type DialogType = 'info' | 'success' | 'warning' | 'error';

export interface DialogOptions {
  title: string;
  message: string;
  type?: DialogType;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  destructive?: boolean;
}

export interface ToastOptions {
  message: string;
  type?: DialogType;
  duration?: number;
}

interface FeedbackContextType {
  showDialog: (options: DialogOptions) => void;
  showToast: (options: ToastOptions) => void;
}

const FeedbackContext = createContext<FeedbackContextType | null>(null);

export const useFeedback = () => {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error('useFeedback must be used within a FeedbackProvider');
  }
  return context;
};

export const FeedbackProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [sheetState, setSheetState] = useState<{ visible: boolean; options: DialogOptions | null }>({
    visible: false,
    options: null,
  });

  const [toastState, setToastState] = useState<{ visible: boolean; options: ToastOptions | null }>({
    visible: false,
    options: null,
  });

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((options: ToastOptions) => {
    // Haptic response
    if (options.type === 'success') haptics.success();
    else if (options.type === 'error') haptics.error();
    else if (options.type === 'warning') haptics.warning();
    else haptics.impact();

    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    
    setToastState({ visible: true, options });
    
    toastTimerRef.current = setTimeout(() => {
      setToastState((prev) => ({ ...prev, visible: false }));
    }, options.duration || 3200);
  }, []);

  const showDialog = useCallback((options: DialogOptions) => {
    // If the dialog is single-action (no cancelText), route it to a sleek floating toast
    // so no intrusive full-screen center popup disrupts the user experience!
    if (!options.cancelText) {
      const formattedMessage = options.title
        ? `${options.title} • ${options.message}`
        : options.message;
      showToast({ message: formattedMessage, type: options.type });
      if (options.onConfirm) {
        options.onConfirm();
      }
      return;
    }

    // For multi-action confirmations (e.g. Cancel Order, Clear Cart), show a sleek Bottom Action Sheet
    haptics.warning();
    setSheetState({ visible: true, options });
  }, [showToast]);

  const hideSheet = useCallback(() => {
    setSheetState((prev) => ({ ...prev, visible: false }));
  }, []);

  const handleConfirm = useCallback(() => {
    haptics.selection();
    hideSheet();
    if (sheetState.options?.onConfirm) {
      setTimeout(() => sheetState.options?.onConfirm?.(), 250);
    }
  }, [sheetState.options, hideSheet]);

  const handleCancel = useCallback(() => {
    haptics.selection();
    hideSheet();
    if (sheetState.options?.onCancel) {
      setTimeout(() => sheetState.options?.onCancel?.(), 250);
    }
  }, [sheetState.options, hideSheet]);

  const getIcon = (type?: DialogType, size = 20) => {
    switch (type) {
      case 'success': return <CheckCircle2 size={size} color="#10B981" />;
      case 'warning': return <AlertTriangle size={size} color="#F59E0B" />;
      case 'error': return <XCircle size={size} color="#EF4444" />;
      default: return <Info size={size} color={tokens.colors.primary} />;
    }
  };

  return (
    <FeedbackContext.Provider value={{ showDialog, showToast }}>
      {children}

      {/* Modern Gestural Bottom Sheet for Confirmation Actions (Zomato/Swiggy style) */}
      <Modal visible={sheetState.visible} transparent animationType="none" statusBarTranslucent onRequestClose={handleCancel}>
        <Animated.View style={styles.sheetOverlay} entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleCancel} />
          
          <Animated.View 
            style={styles.sheetContainer} 
            entering={SlideInDown.springify().damping(18).stiffness(140)} 
            exiting={SlideOutDown.duration(200)}
          >
            <View style={styles.sheetHandle} />

            {sheetState.options && (
              <View style={styles.sheetContent}>
                <View style={styles.sheetHeader}>
                  <View style={[
                    styles.sheetIconBox,
                    sheetState.options.destructive && { backgroundColor: '#FEF2F2' }
                  ]}>
                    {getIcon(sheetState.options.type, 24)}
                  </View>
                  <Text allowFontScaling={false} style={styles.sheetTitle}>{sheetState.options.title}</Text>
                </View>

                <Text allowFontScaling={false} style={styles.sheetMessage}>{sheetState.options.message}</Text>
                
                <View style={styles.sheetActions}>
                  <PressableScale style={styles.cancelBtn} onPress={handleCancel}>
                    <Text allowFontScaling={false} style={styles.cancelBtnText}>
                      {sheetState.options.cancelText || 'Cancel'}
                    </Text>
                  </PressableScale>
                  
                  <PressableScale 
                    style={[
                      styles.confirmBtn, 
                      sheetState.options.destructive && styles.destructiveBtn
                    ]} 
                    onPress={handleConfirm}
                  >
                    <Text allowFontScaling={false} style={styles.confirmBtnText}>
                      {sheetState.options.confirmText || 'Confirm'}
                    </Text>
                  </PressableScale>
                </View>
              </View>
            )}
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* Modern Floating Pill Toast Notification (Uber/Blinkit style) */}
      {toastState.visible && toastState.options && (
        <Animated.View 
          style={styles.toastContainer} 
          entering={SlideInDown.springify().damping(16).stiffness(130)} 
          exiting={SlideOutDown.duration(180)}
        >
          <PressableScale 
            style={styles.toastPill} 
            onPress={() => setToastState((prev) => ({ ...prev, visible: false }))}
          >
            <View style={styles.toastIconBox}>
              {getIcon(toastState.options.type, 18)}
            </View>
            <Text allowFontScaling={false} style={styles.toastText} numberOfLines={2}>
              {toastState.options.message}
            </Text>
            <X size={14} color="#94A3B8" style={{ marginLeft: 4 }} />
          </PressableScale>
        </Animated.View>
      )}
    </FeedbackContext.Provider>
  );
};

const styles = StyleSheet.create({
  // Bottom Sheet
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingHorizontal: 24,
    paddingBottom: 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 20,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetContent: {
    alignItems: 'center',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
    width: '100%',
  },
  sheetIconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    fontSize: 18,
    fontFamily: tokens.typography.family.bold,
    color: '#0F172A',
    flex: 1,
  },
  sheetMessage: {
    fontSize: 14,
    fontFamily: tokens.typography.family.medium,
    color: '#475569',
    lineHeight: 21,
    marginBottom: 24,
    alignSelf: 'flex-start',
  },
  sheetActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontFamily: tokens.typography.family.bold,
    color: '#475569',
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: tokens.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destructiveBtn: {
    backgroundColor: '#EF4444',
  },
  confirmBtnText: {
    fontSize: 14,
    fontFamily: tokens.typography.family.bold,
    color: '#FFFFFF',
  },

  // Floating Toast Pill
  toastContainer: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 99999,
  },
  toastPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 30,
    maxWidth: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    gap: 10,
  },
  toastIconBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastText: {
    fontSize: 13,
    fontFamily: tokens.typography.family.medium,
    color: '#F8FAFC',
    flexShrink: 1,
    lineHeight: 18,
  },
});
