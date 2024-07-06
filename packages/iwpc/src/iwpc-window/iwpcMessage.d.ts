export type NotifyWindowId = {
  type: 'NOTIFIY_WINDOW_ID';
  myWindowId: string;
};

export type RecievedWindowId = {
  type: 'RECEIVED_WINDOW_ID';
  yourWindowId: string;
  myWindowId: string;
};

type IwpcMessageBase = {
  iwpcTaskId: string;
  processId: string;
  targetWindowId: string;
  senderWindowId: string;
};

export type IwpcInvokeMessage = IwpcMessageBase & {
  type: 'INVOKE';
  args: unknown;
};

export type IwpcReturnMessage = IwpcMessageBase & {
  type: 'RETURN';
  returnValue: unknown;
};

export type IwpcMessage = IwpcInvokeMessage | IwpcReturnMessage;
