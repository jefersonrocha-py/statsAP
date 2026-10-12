import { create } from "zustand";

// Dados do usuário logado, compartilhados entre a sidebar e a tela Minha Conta:
// o que é salvo em Minha Conta aparece na sidebar na hora.

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  role: "SUPERADMIN" | "ADMIN" | "USER";
  phone: string | null;
  jobTitle: string | null;
  avatarUrl: string | null;
};

type ProfileState = {
  profile: UserProfile | null;
  setProfile: (profile: UserProfile | null) => void;
  patchProfile: (changes: Partial<UserProfile>) => void;
};

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  setProfile: (profile) => set({ profile }),
  patchProfile: (changes) => set((state) => (state.profile ? { profile: { ...state.profile, ...changes } } : state)),
}));
