// ============================================================
// PROJECT_365 — Error Boundary (catches render crashes on web)
// ============================================================

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { DARK_THEME, SPACING, FONT_SIZE, RADIUS } from '../theme';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>
            {this.state.error?.message ?? 'Unknown error'}
          </Text>
          <ScrollView style={styles.stack}>
            <Text style={styles.stackText}>
              {this.state.error?.stack ?? ''}
            </Text>
          </ScrollView>
          <TouchableOpacity
            style={styles.btn}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={styles.btnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const T = DARK_THEME;
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.background,
    padding: SPACING.lg,
    justifyContent: 'center',
  },
  title: {
    color: T.missed,
    fontSize: FONT_SIZE.xl,
    fontWeight: '800',
    marginBottom: SPACING.sm,
  },
  subtitle: {
    color: T.text,
    fontSize: FONT_SIZE.md,
    marginBottom: SPACING.md,
  },
  stack: {
    backgroundColor: T.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    maxHeight: 300,
    marginBottom: SPACING.lg,
  },
  stackText: {
    color: T.textMuted,
    fontSize: 11,
    fontFamily: 'monospace',
  },
  btn: {
    backgroundColor: T.primary,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: FONT_SIZE.md },
});
