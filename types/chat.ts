export interface ChatMessage {
  sender: string
  content: string
  timestamp: string
  isMafiaChat?: boolean
  isSystem?: boolean
}
