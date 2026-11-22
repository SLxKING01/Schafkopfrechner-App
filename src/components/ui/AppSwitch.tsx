import { Switch, type SwitchProps } from 'react-native';

/**
 * `Switch` that keeps its configured colours on the web. react-native-web
 * ignores `thumbColor` for the "on" state and falls back to a teal default
 * unless `activeThumbColor` is set, so we pass the same colour through.
 */
export function AppSwitch(props: SwitchProps) {
  const thumbColor = props.thumbColor ?? '#F5F5F5';
  const webColors = {
    activeThumbColor: thumbColor,
    activeTrackColor: props.trackColor?.true ?? undefined,
  };
  return <Switch {...props} {...(webColors as object)} />;
}
