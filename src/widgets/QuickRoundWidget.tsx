import { HStack, Image, Text } from '@expo/ui/swift-ui';
import { containerBackground, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';

export default createWidget(
  'QuickRound',
  () => {
    'widget';
    return (
      <HStack
        modifiers={[
          containerBackground('transparent', 'widget'),
          widgetURL('schafkopfrechner://spiel-eintragen'),
        ]}
      >
        <Image systemName="plus.circle" />
        <Text>Spiel eintragen</Text>
      </HStack>
    );
  },
  {},
);
