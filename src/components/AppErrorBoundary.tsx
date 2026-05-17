import type { ErrorInfo, ReactNode } from 'react';
import { Component } from 'react';
import { StyleSheet, View } from 'react-native';

import { theme } from '../constants/theme';
import { AppButton } from './ui/AppButton';
import { AppText } from './ui/AppText';

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled app error', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <AppText variant="title">Etwas ist schiefgelaufen</AppText>
          <AppText variant="caption">
            Die App konnte diese Ansicht nicht laden. Bitte versuche es erneut.
          </AppText>
          <AppButton title="Erneut versuchen" onPress={this.handleReset} />
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.background,
    flex: 1,
    gap: theme.spacing.lg,
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
});
