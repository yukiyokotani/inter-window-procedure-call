'use client';
import { useLayoutEffect, useState } from 'react';

import { IwpcOptions, IwpcWindow } from '../iwpc-window/IwpcWindow';

export const useIwpcWindow = (options?: IwpcOptions) => {
  const [iwpcWindow] = useState(() => {
    if (typeof window !== 'undefined') {
      return new IwpcWindow(window, options);
    }
  });

  useLayoutEffect(() => {
    iwpcWindow?.initialize();
    return () => {
      iwpcWindow?.dispose();
    };
  }, [iwpcWindow]);

  return iwpcWindow;
};
