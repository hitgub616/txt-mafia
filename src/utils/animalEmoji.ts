export const animalList = [
  { emoji: '🐶', name: '강아지' },
  { emoji: '🐱', name: '고양이' },
  { emoji: '🐭', name: '생쥐' },
  { emoji: '🐹', name: '햄스터' },
  { emoji: '🐰', name: '토끼' },
  { emoji: '🦊', name: '여우' },
  { emoji: '🐻', name: '곰돌이' },
  { emoji: '🐼', name: '판다' },
  { emoji: '🐨', name: '코알라' },
  { emoji: '🐯', name: '호랑이' }
];

export function getRandomAnimal() {
  const idx = Math.floor(Math.random() * animalList.length);
  return animalList[idx];
}

export function getAnimalName(emoji: string): string {
  const found = animalList.find((a) => a.emoji === emoji);
  return found ? found.name : '';
} 