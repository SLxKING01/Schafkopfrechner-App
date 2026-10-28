import BottomSheet, {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Modal, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { authColors } from '../../theme/colors';

type InteractionSheetProps = {
  children: ReactNode;
  visible: boolean;
  onClose: () => void;
  onDismiss?: () => void;
  dismissible?: boolean;
  fullScreen?: boolean;
};

/** Keep the modal mounted until the sheet's closing gesture/animation completes. */
export function InteractionSheet({
  children,
  visible,
  onClose,
  onDismiss,
  dismissible = true,
  fullScreen = false,
}: InteractionSheetProps) {
  const sheetRef = useRef<BottomSheet>(null);
  const [presented, setPresented] = useState(visible);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!visible) sheetRef.current?.close();
  }, [visible]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior={dismissible ? 'close' : 'none'}
      />
    ),
    [dismissible],
  );

  return (
    <Modal
      transparent
      animationType="none"
      visible={visible || presented}
      onShow={() => setPresented(true)}
      onRequestClose={() => {
        if (dismissible) sheetRef.current?.close();
      }}
    >
      <GestureHandlerRootView style={styles.root}>
        {visible || presented ? (
          <BottomSheet
            accessible={false}
            accessibilityRole={null}
            accessibilityLabel={null}
            ref={sheetRef}
            index={0}
            snapPoints={[fullScreen ? '100%' : '85%']}
            handleComponent={fullScreen ? null : undefined}
            enableDynamicSizing={false}
            enablePanDownToClose={dismissible}
            topInset={insets.top}
            bottomInset={insets.bottom}
            keyboardBehavior="interactive"
            keyboardBlurBehavior="restore"
            enableBlurKeyboardOnGesture
            android_keyboardInputMode="adjustResize"
            backdropComponent={renderBackdrop}
            backgroundStyle={[
              styles.background,
              fullScreen && { borderRadius: 0 },
            ]}
            handleIndicatorStyle={styles.handle}
            onClose={() => {
              setPresented(false);
              if (visible) onClose();
              onDismiss?.();
            }}
          >
            {children}
          </BottomSheet>
        ) : null}
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  background: { backgroundColor: '#0B1D16' },
  handle: { backgroundColor: authColors.textSecondary, width: 42 },
});
