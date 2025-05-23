export interface Character {
  emoji: string
  name: string
  value: string
}

export const CHARACTER_LIST: Character[] = [
  { emoji: "🏛️", name: "촌장", value: "촌장" },
  { emoji: "👨‍⚕️", name: "의원", value: "의원" },
  { emoji: "💰", name: "상인", value: "상인" },
  { emoji: "🌾", name: "농부", value: "농부" },
  { emoji: "🎣", name: "어부", value: "어부" },
  { emoji: "🏹", name: "사냥꾼", value: "사냥꾼" },
  { emoji: "🔨", name: "목수", value: "목수" },
  { emoji: "🎶", name: "악사", value: "악사" },
  { emoji: "📜", name: "시인", value: "시인" },
  { emoji: "🎨", name: "화가", value: "화가" },
  { emoji: "🧑‍🏫", name: "교사", value: "교사" },
  { emoji: "✉️", name: "우체부", value: "우체부" },
  { emoji: "✂️", name: "이발사", value: "이발사" },
  { emoji: "🍳", name: "요리사", value: "요리사" },
  { emoji: "🛡️", name: "경비", value: "경비" },
  { emoji: "📚", name: "학자", value: "학자" },
  { emoji: "⚒️", name: "대장장이", value: "대장장이" },
  { emoji: "🧙‍♂️", name: "마법사", value: "마법사" },
  { emoji: "🎭", name: "배우", value: "배우" },
  { emoji: "🏺", name: "도공", value: "도공" },
]

export const AI_CHARACTER_LIST: Character[] = [
  { emoji: "🤖", name: "로봇농부", value: "로봇농부" },
  { emoji: "🤖", name: "로봇상인", value: "로봇상인" },
  { emoji: "🤖", name: "로봇목수", value: "로봇목수" },
  { emoji: "🤖", name: "로봇요리사", value: "로봇요리사" },
  { emoji: "🤖", name: "로봇경비", value: "로봇경비" },
  { emoji: "🤖", name: "로봇의원", value: "로봇의원" },
  { emoji: "🤖", name: "로봇어부", value: "로봇어부" },
  { emoji: "🤖", name: "로봇악사", value: "로봇악사" },
  { emoji: "🤖", name: "로봇화가", value: "로봇화가" },
  { emoji: "🤖", name: "로봇교사", value: "로봇교사" },
]

export function getCharacterDisplay(character: Character): string {
  return `${character.emoji} ${character.name}`
}

export function parseCharacterFromNickname(nickname: string): Character | null {
  // "🏛️ 촌장" 형태에서 이모지와 이름 분리
  const match = nickname.match(/^(.+?)\s+(.+)$/)
  if (match) {
    const [, emoji, name] = match
    return { emoji, name, value: name }
  }

  // 기존 닉네임 호환성을 위한 처리
  const found = CHARACTER_LIST.find((char) => char.name === nickname || char.value === nickname)
  if (found) return found

  const aiFound = AI_CHARACTER_LIST.find((char) => char.name === nickname || char.value === nickname)
  if (aiFound) return aiFound

  return null
}
