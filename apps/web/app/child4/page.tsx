'use client';

import { ReturnValueChildBody } from '@/components/return-value-child';

export default function Page() {
  return (
    <ReturnValueChildBody
      transport='postMessage'
      transportLabel='postMessage'
    />
  );
}
