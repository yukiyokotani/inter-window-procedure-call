'use client';
import { useLayoutEffect, useRef } from 'react';
import { IwpcWindow } from '../iwpc-window/iwpcWindow';

type Option = {
  debug?: boolean;
};

const iwpcWindow = new IwpcWindow(window);

export const useIwpcWindow = (option?: Option) => {
  // const ref = useRef<IwpcWindow>();

  // useLayoutEffect(() => {
  //   console.log('1');
  //   if (ref.current === undefined) {
  //     console.log('2');
  //     const instance = new IwpcWindow(window);
  //     ref.current = instance;
  //     return () => {
  //       console.log('3');
  //       instance.dispose();
  //       ref.current = undefined;
  //     };
  //   }
  // }, []);

  // const [iwpcWindow] = useState(() => {
  //   console.log('🌟', 'initialized iwpc window');
  //   if (typeof window !== 'undefined') {
  //     return new IwpcWindow(window);
  //   }
  // });

  return iwpcWindow;
};
