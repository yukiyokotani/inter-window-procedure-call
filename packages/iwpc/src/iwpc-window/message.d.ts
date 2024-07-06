export type NotifyWindowIdMessage = {
  type: 'NOTIFIY_WINDOW_ID';
  myWindowId: string;
};

export type RecievedWindowIdMessage = {
  type: 'RECEIVED_WINDOW_ID';
  yourWindowId: string;
  myWindowId: string;
};

type IwpcMessageBaseMessage = {
  iwpcTaskId: string;
  processId: string;
  targetWindowId: string;
  senderWindowId: string;
};

export type IwpcInvokeMessage = IwpcMessageBaseMessage & {
  type: 'INVOKE';
  args: unknown;
};

export type IwpcReturnMessage = IwpcMessageBaseMessage & {
  type: 'RETURN';
  returnValue: unknown;
};

export type IwpcMessage = IwpcInvokeMessage | IwpcReturnMessage;
