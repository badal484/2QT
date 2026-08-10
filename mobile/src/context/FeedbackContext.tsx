import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { StyleSheet, View, Text, Modal, TouchableOpacity } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown, ZoomIn, ZoomOut } from 'react-native-reanimated';
import { tokens } from '../theme/tokens';
import { CheckCircle2, AlertTriangle, Info, XCircle } from 'lucide-react-native';

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
  const [dialogState, setDialogState] = useState<{ visible: boolean; options: DialogOptions | null }>({
    visible: false,
    options: null,
  });

  const [toastState, setToastState] = useState<{ visible: boolean; options: ToastOptions | null }>({
    visible: false,
    options: null,
  });

  const showDialog = useCallback((options: DialogOptions) => {
    setDialogState({ visible: true, options });
  }, []);

  const hideDialog = useCallback(() => {
    setDialogState((prev) => ({ ...prev, visible: false }));
  }, []);

  const handleConfirm = useCallback(() => {
    hideDialog();
    if (dialogState.options?.onConfirm) {
      setTimeout(() => dialogState.options?.onConfirm?.(), 300); // Wait for exit animation
    }
  }, [dialogState.options, hideDialog]);

  const handleCancel = useCallback(() => {
    hideDialog();
    if (dialogState.options?.onCancel) {
      setTimeout(() => dialogState.options?.onCancel?.(), 300);
    }
  }, [dialogState.options, hideDialog]);

  const showToast = useCallback((options: ToastOptions) => {
    setToastState({ visible: true, options });
    setTimeout(() => {
      setToastState((prev) => ({ ...prev, visible: false }));
    }, options.duration || 3000);
  }, []);

  const getIcon = (type?: DialogType, size = 24) => {
    switch (type) {
      case 'success': return <CheckCircle2 size={size} color={tokens.colors.success} />;
      case 'warning': return <AlertTriangle size={size} color={tokens.colors.warning} />;
      case 'error': return <XCircle size={size} color={tokens.colors.error} />;
      default: return <Info size={size} color={tokens.colors.primary} />;
    }
  };

  return (
    <FeedbackContext.Provider value={{ showDialog, showToast }}>
      {children}

      {/* Custom Dialog Modal */}
      <Modal visible={dialogState.visible} transparent animationType="none" statusBarTranslucent>
        <Animated.View style={styles.dialogOverlay} entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)}>
          <Animated.View style={styles.dialogContent} entering={ZoomIn.duration(220)} exiting={ZoomOut.duration(180)}>
            {dialogState.options && (
              <>
                <View style={styles.dialogHeader}>
                  {getIcon(dialogState.options.type, 32)}
                  <Text style={styles.dialogTitle}>{dialogState.options.title}</Text>
                </View>
                <Text style={styles.dialogMessage}>{dialogState.options.message}</Text>
                
                <View style={styles.dialogActions}>
                  {dialogState.options.cancelText && (
                    <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} activeOpacity={0.7}>
                      <Text style={styles.cancelBtnText}>{dialogState.options.cancelText}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity 
                    style={[
                      styles.confirmBtn, 
                      dialogState.options.destructive && styles.destructiveBtn
                    ]} 
                    onPress={handleConfirm} 
                    activeOpacity={0.7}
                  >
                    <Text style={styles.confirmBtnText}>{dialogState.options.confirmText || 'OK'}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* Global Toast Overlay (can be positioned over everything) */}
      {toastState.visible && toastState.options && (
        <Animated.View style={styles.toastContainer} entering={SlideInDown.duration(250)} exiting={SlideOutDown.duration(200)}>
          <View style={styles.toastContent}>
            {getIcon(toastState.options.type, 20)}
            <Text style={styles.toastText}>{toastState.options.message}</Text>
          </View>
        </Animated.View>
      )}
    </FeedbackContext.Provider>
  );
};

const styles = StyleSheet.create({
  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.lg,
  },
  dialogContent: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.xl,
    padding: tokens.spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  dialogHeader: {
    alignItems: 'center',
    marginBottom: tokens.spacing.md,
  },
  dialogTitle: {
    fontSize: tokens.typography.size.h3,
    fontFamily: tokens.typography.family.bold,
    color: tokens.colors.textPrimary,
    marginTop: tokens.spacing.sm,
    textAlign: 'center',
  },
  dialogMessage: {
    fontSize: tokens.typography.size.body,
    fontFamily: tokens.typography.family.medium,
    color: tokens.colors.textSecondary,
    textAlign: 'center',
    marginBottom: tokens.spacing.xl,
    lineHeight: 22,
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: tokens.spacing.md,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: tokens.spacing.md,
    borderRadius: tokens.radii.lg,
    backgroundColor: tokens.colors.background,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: tokens.typography.size.button,
    fontFamily: tokens.typography.family.bold,
    color: tokens.colors.textSecondary,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: tokens.spacing.md,
    borderRadius: tokens.radii.lg,
    backgroundColor: tokens.colors.primary,
    alignItems: 'center',
  },
  destructiveBtn: {
    backgroundColor: tokens.colors.error,
  },
  confirmBtnText: {
    fontSize: tokens.typography.size.button,
    fontFamily: tokens.typography.family.bold,
    color: tokens.colors.white,
  },
  toastContainer: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 9999,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surface,
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.lg,
    borderRadius: tokens.radii.full,
    gap: tokens.spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  toastText: {
    fontSize: tokens.typography.size.caption,
    fontFamily: tokens.typography.family.bold,
    color: tokens.colors.textPrimary,
  }
});
