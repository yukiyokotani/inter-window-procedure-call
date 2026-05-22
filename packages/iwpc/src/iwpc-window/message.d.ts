export type NotifyWindowIdMessage = {
  type: 'NOTIFY_WINDOW_ID';
  myWindowId: string;
};

export type ReceivedWindowIdMessage = {
  type: 'RECEIVED_WINDOW_ID';
  yourWindowId: string;
  myWindowId: string;
};

export type IwpcHandshakeMessage =
  | NotifyWindowIdMessage
  | ReceivedWindowIdMessage;

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
  error?: { name: string; message: string };
};

export type IwpcMessage =
  | IwpcInvokeMessage
  | IwpcReturnMessage
  | NotifyWindowIdMessage
  | ReceivedWindowIdMessage;
