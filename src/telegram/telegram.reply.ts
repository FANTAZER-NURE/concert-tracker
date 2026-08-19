export type ReplyButton = {
  label: string;
  data: string;
};

export type BotReply = {
  text: string;
  buttons?: ReplyButton[][];
};
