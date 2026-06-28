export type TeamMember = {
  id: string;
  name: string;
  email: string | null;
  slug: string;
  active: boolean;
  userId: string | null;
  // Profile (Phase G)
  photo: string | null;
  phone: string | null;
  whatsapp: string | null;
  title: string | null;
  languages: string[] | null;
  bios: Record<string, string> | null;
};
