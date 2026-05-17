'use client';
import { useEffect, useRef, useState } from 'react';

import { IwpcOptions, IwpcWindow } from '../iwpc-window/iwpcWindow';

export const useIwpcWindow = (options?: IwpcOptions) => {
  const [iwpcWindow, setIwpcWindow] = useState<IwpcWindow | undefined>(
    undefined
  );
  // Keep the latest options without retriggering the connect effect.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const instance = new IwpcWindow(window, optionsRef.current);
    instance.initialize();
    setIwpcWindow(instance);
    return () => {
      instance.dispose();
      setIwpcWindow((current) => (current === instance ? undefined : current));
    };
  }, []);

  return iwpcWindow;
};
