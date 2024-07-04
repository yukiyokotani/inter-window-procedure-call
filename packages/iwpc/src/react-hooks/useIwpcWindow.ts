'use client';
import { useState } from 'react';
import { IwpcWindow } from '../iwpc-window/iwpcWindow';

type Option = {
  debug?: boolean;
};

export const useIwpcWindow = (option?: Option) => {
  const [iwpcWindow] = useState(() => {
    if (typeof window !== 'undefined') {
      return new IwpcWindow(window);
    }
  });

  return iwpcWindow;
};
