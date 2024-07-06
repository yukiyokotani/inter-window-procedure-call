'use client';
import { useLayoutEffect, useState } from 'react';

import { IwpcWindow } from '../iwpc-window/iwpcWindow';

type Option = {
  debug?: boolean;
};

// const iwpcWindow = new IwpcWindow(window);

export const useIwpcWindow = (option?: Option) => {
  const [iwpcWindow] = useState(() => {
    if (typeof window !== 'undefined') {
      return new IwpcWindow(window);
    }
  });

  useLayoutEffect(() => {
    iwpcWindow?.initialize();
    return () => iwpcWindow?.dispose();
  }, [iwpcWindow]);

  return iwpcWindow;
};
