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
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import {
  GestureDetector,
  GestureHandlerRootView,
  usePanGesture,
} from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { authColors } from '../../theme/colors';
import { AuthBackground } from '../auth/AuthBackground';

type InteractionSheetProps = {
  children: ReactNode;
  visible: boolean;
  onClose: () => void;
  onDismiss?: () => void;
  dismissible?: boolean;
  fullScreen?: boolean;
  contentHandlesSafeArea?: boolean;
  swipeRightToClose?: boolean;
};

/** Keep the modal mounted until the sheet's closing gesture/animation completes. */
export function InteractionSheet(props: InteractionSheetProps) {
  return props.fullScreen ? (
    <FullScreenSheet {...props} />
  ) : (
    <BottomInteractionSheet {...props} />
  );
}

function FullScreenSheet({
  children,
  visible,
  onClose,
  onDismiss,
  dismissible = true,
  contentHandlesSafeArea = false,
  swipeRightToClose = false,
}: InteractionSheetProps) {
  const insets = useSafeAreaInsets();
  const wasVisible = useRef(visible);
  useEffect(() => {
    if (wasVisible.current && !visible) onDismiss?.();
    wasVisible.current = visible;
  }, [visible, onDismiss]);
  const content = (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {children}
    </KeyboardAvoidingView>
  );
  return (
    <Modal
      transparent
      animationType="none"
      visible={visible}
      onRequestClose={() => {
        if (dismissible) onClose();
      }}
    >
      <GestureHandlerRootView style={styles.root}>
        <AuthBackground withEdgeBorder={false} withSafeArea={false}>
          <View
            style={[
              styles.root,
              !contentHandlesSafeArea && {
                paddingTop: insets.top,
                paddingBottom: insets.bottom,
                paddingLeft: insets.left,
                paddingRight: insets.right,
              },
            ]}
          >
            {swipeRightToClose ? (
              <SwipeBack enabled={dismissible} onBack={onClose}>
                {content}
              </SwipeBack>
            ) : (
              content
            )}
          </View>
        </AuthBackground>
      </GestureHandlerRootView>
    </Modal>
  );
}

function SwipeBack({
  children,
  enabled,
  onBack,
}: {
  children: ReactNode;
  enabled: boolean;
  onBack: () => void;
}) {
  const swipe = usePanGesture({
    enabled,
    activeOffsetX: 24,
    failOffsetY: [-16, 16],
    maxPointers: 1,
    runOnJS: true,
    onDeactivate: ({ translationX, translationY, canceled }) => {
      if (
        !canceled &&
        translationX >= 72 &&
        translationX > Math.abs(translationY) * 2
      ) {
        onBack();
      }
    },
  });
  return (
    <GestureDetector gesture={swipe}>
      <View style={styles.root} collapsable={false}>
        {children}
      </View>
    </GestureDetector>
  );
}

function BottomInteractionSheet({
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
            containerStyle={{
              marginLeft: insets.left,
              marginRight: insets.right,
            }}
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
