import React from 'react';
import MultimodalInputBar, { MultimodalInputBarProps } from './MultimodalInputBar';

export type ChatInputBarProps = MultimodalInputBarProps;

export const ChatInputBar: React.FC<ChatInputBarProps> = (props) => {
  return <MultimodalInputBar {...props} />;
};

export default ChatInputBar;
