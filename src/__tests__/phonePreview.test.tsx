import { act } from 'react';

import { AppViewport } from '../components/preview/AppViewport.web';
import {
  phonePresets,
  phonePreviewScale,
  phonePreviewUrl,
  shouldShowPhonePreview,
} from '../components/preview/phonePreview';

const renderer = jest.requireActual('react-test-renderer');
jest.mock('react-native', () => ({
  useWindowDimensions: () => ({ width: 1280, height: 900 }),
}));
const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
let mockHref = 'http://localhost:8081/';
let mockCoarse = false;
beforeEach(() => {
  mockHref = 'http://localhost:8081/';
  mockCoarse = false;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      location: {
        get href() {
          return mockHref;
        },
      },
      innerWidth: 1280,
      matchMedia: () => ({ matches: mockCoarse }),
    },
  });
});
afterAll(() => {
  if (windowDescriptor)
    Object.defineProperty(globalThis, 'window', windowDescriptor);
  else Reflect.deleteProperty(globalThis, 'window');
});

it('uses one embedded document on desktop, never recursively embeds or frames mobile pages', () => {
  expect(shouldShowPhonePreview('http://localhost/', 1280)).toBe(true);
  expect(
    shouldShowPhonePreview('http://localhost/?__app_viewport=1', 1280),
  ).toBe(false);
  expect(shouldShowPhonePreview('http://localhost/?preview=off', 1280)).toBe(
    false,
  );
  expect(shouldShowPhonePreview('http://localhost/', 393)).toBe(false);
  const url = new URL(
    phonePreviewUrl('http://localhost:8081/path?test=keep&preview=off#round'),
  );
  expect(url.searchParams.get('test')).toBe('keep');
  expect(url.hash).toBe('#round');
  expect(url.searchParams.get('__app_viewport')).toBe('1');
  expect(url.searchParams.has('preview')).toBe(false);
});
it('fits every phone preset inside a typical desktop window without stretching its actual viewport', () => {
  for (const p of phonePresets) {
    const scale = phonePreviewScale(1280, 800, p.width, p.height);
    expect(scale).toBeLessThanOrEqual(1);
    expect((p.width + 20) * scale).toBeLessThanOrEqual(1280 - 48);
    expect((p.height + 20) * scale).toBeLessThanOrEqual(800 - 142);
  }
});
it('keeps dialogs inside the iframe viewport and preserves the app document when switching sizes', async () => {
  let view: ReturnType<typeof renderer.create>;
  await act(async () => {
    view = renderer.create(
      <AppViewport>
        <span>App content</span>
      </AppViewport>,
    );
  });
  expect(
    view.root
      .findAllByType('span')
      .some(
        (node: { props: { children: unknown } }) =>
          node.props.children === 'App content',
      ),
  ).toBe(false);
  const source = view.root.findByType('iframe').props.src;
  expect(view.root.findByType('iframe').props.style.width).toBe(393);
  await act(async () =>
    view.root
      .findAllByType('button')
      .find(
        (node: { props: { children: unknown } }) =>
          node.props.children === 'Groß',
      )!
      .props.onClick(),
  );
  expect(view.root.findByType('iframe').props.style.width).toBe(430);
  expect(view.root.findByType('iframe').props.src).toBe(source);
  await act(async () => view.unmount());
});
it.each(['embedded', 'full-screen', 'touch'])(
  'renders the real app directly in %s mode',
  async (mode) => {
    if (mode === 'embedded') mockHref = 'http://localhost/?__app_viewport=1';
    if (mode === 'full-screen') mockHref = 'http://localhost/?preview=off';
    if (mode === 'touch') mockCoarse = true;
    let view: ReturnType<typeof renderer.create>;
    await act(async () => {
      view = renderer.create(
        <AppViewport>
          <span>App content</span>
        </AppViewport>,
      );
    });
    expect(view.root.findAllByType('iframe')).toHaveLength(0);
    expect(view.root.findByType('span').props.children).toBe('App content');
    await act(async () => view.unmount());
  },
);
