export const adjectives = ['신비한', '수상한', '평화로운', '은밀한', '빠른', '느린', '뜨거운', '차가운'];
export const nouns = ['고양이', '여우', '토끼', '늑대', '호랑이', '참새', '부엉이', '고래'];

export function getRandomKoreanRoomName(): string {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adj} ${noun}`; // 예: "신비한 고양이"
} 