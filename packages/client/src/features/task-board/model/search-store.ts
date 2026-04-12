import { createStore } from 'zustand/vanilla'

type BoardSearchStore = {
  searchQuery: string
  setSearchQuery: (value: string) => void
}

export function createBoardSearchStore() {
  return createStore<BoardSearchStore>(set => ({
    searchQuery: '',
    setSearchQuery: value => set({ searchQuery: value }),
  }))
}

export type { BoardSearchStore }
export type BoardSearchStoreApi = ReturnType<typeof createBoardSearchStore>
